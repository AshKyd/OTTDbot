import config from "../config.json" assert { type: "json" };
import { default as OpenTTDAdmin, enums } from "./openttdAdmin.mjs";
import { getRestartTime, loopResetGame } from "./loopResetGame.mjs";
import { loopCleanCompanies } from "./loopCleanCompanies.mjs";

let server = new OpenTTDAdmin();

const PORT = process.env.SERVER_ADMIN_PORT || 3977;

function connect() {
  server.connect(process.env.SERVER, PORT);
}
connect();

server.on("connect", function () {
  server.authenticate("MyBot", process.env.PASSWORD);
});
server.on("welcome", function (data) {
  [enums.UpdateTypes.CLIENT_INFO, enums.UpdateTypes.CHAT].forEach(
    (updateType) =>
      server.send_update_frequency(
        updateType,
        enums.UpdateFrequencies.AUTOMATIC
      )
  );
  setTimeout(loop, 1000);
});

const clientInfo = {};
function getClient(id) {
  return {
    id: id,
    name: "Unknown",
    ip: "",
    lang: "",
    joinDate: 0,
    company: 255,
    ...clientInfo[id],
  };
}

server.on("clientjoin", function (id) {
  console.log("client", `Client with id: ${id} has joined the game.`);
  config.welcomeMessage.forEach((line) => server.sayClient(id, line));
});

server.on("clientinfo", function ({ id, ip, name, lang, joindate, company }) {
  clientInfo[id] = {
    id,
    ip,
    name,
    lang,
    joindate,
    company,
  };
  console.log(
    `client info: #${id} (${getClient(id).name}) has new info: ${JSON.stringify(
      clientInfo[id]
    )}`
  );
});
server.on("clientupdate", function (client) {
  clientInfo[client.id] = {
    ...clientInfo[client.id],
    ...client,
  };
  console.log(
    `client update: #${client.id} (${
      getClient(client.id).name
    }) has updated: ${JSON.stringify(client)}`
  );
});
server.on("clientquit", function (id) {
  console.log(`client quit: #${id} (${getClient(id).name}) has quit`);
});
server.on("clienterror", function (client) {
  console.log(
    `client error: client #${client.id} (${
      getClient(client.id).name
    }) has had error: ${client.err}`
  );
});

server.on("error", (error) => {
  if (error === "connectionclose") {
    console.log(
      `error: connection to ${process.env.SERVER}:${PORT} closed. Reconnecting in 5s.`
    );
    server.close();
    setTimeout(connect, 5000);
  } else {
    console.error("error: ", error);
  }
});

server.on("chat", function ({ action, desttype, id, message, money }) {
  const textCommandRespons = config.textCommands[message];

  console.log(
    `chat (${desttype}): #${id}  (${getClient(id).name}): ${message}`
  );

  if (textCommandRespons) {
    console.log(`command - responded to ${message} command`);
    textCommandRespons.forEach((line) => server.sayClient(id, line));
    return;
  }

  if (message === "!reset") {
    server.rcon("clients").then(async (clients) => {
      const companyId = clients.find(
        (client) => client.id === Number(id)
      )?.company;

      if (!companyId || companyId === 255) {
        console.log(
          `command reset: user is not a member of a company to reset`
        );
        return server.sayClient(
          id,
          "You need to be a member of a company before you can reset it."
        );
      }
      const clientsInCompany = clients.filter(
        (client) => client.company === companyId
      ).length;
      if (clientsInCompany > 1) {
        console.log(
          `command reset: not resetting company with other members active`
        );
        return server.sayClient(
          id,
          "There are other people in this company. You can only reset it after they leave."
        );
      }

      try {
        console.log(`command reset: resetting company ${companyId}`);
        const move = await server.rcon("move", `${id} 255`);
        const resetLines = await server.rcon("reset_company", companyId);

        console.log(
          `command - company has been reset - ${resetLines.join(" - ")}`
        );
      } catch (e) {
        console.log(
          `command reset: resetting company ${companyId} failed - e.message`
        );
      }
    });

    server.rcon("companies").then(console.log);
  }

  if (message === "!end") {
    const end = getRestartTime();
    // don't reply if the end has already begun
    if (end < 0) {
      return;
    }
    const relativeEnd = getRelativeEnd(end);
    server.say(`This server resets in ${relativeEnd}`);
  }
});

function getRelativeEnd(end) {
  const endSeconds = Math.floor(end / 1000);
  if (endSeconds <= 120) {
    return `${endSeconds} seconds`;
  }
  const endMinutes = Math.floor(endSeconds / 60);
  if (endMinutes <= 60) {
    return `${endMinutes} minutes`;
  }
  const hrHours = Math.floor(endMinutes / 60);
  const hrMinutes = endMinutes % 60;
  return `${hrHours} hours, ${hrMinutes} minutes`;
}

let i = 0;
async function loop() {
  i++;
  console.log("- running loop");
  const args = { server };

  if (i % 10 === 0) {
    await loopCleanCompanies(args);
  }

  await loopResetGame(args);

  setTimeout(loop, 10000);
}
