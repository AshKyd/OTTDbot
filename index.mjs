import { addHours, formatDistance } from "date-fns";
import config from "./config.json" assert { type: "json" };
import { default as OpenTTDAdmin, enums } from "./src/openttdAdmin.mjs";
import { getRestartTime, loopResetGame } from "./src/loopResetGame.mjs";
import { loopCleanCompanies } from "./src/loopCleanCompanies.mjs";

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

server.on("clientjoin", function (id) {
  console.log("Client with id: ", id, " has joined the game.");
  config.welcomeMessage.forEach((line) => server.sayClient(id, line));
});

server.on("clientinfo", function ({ id, ip, name, lang, joindate, company }) {
  console.log("Info for client: ", { id, ip, name, lang, joindate, company });
});
server.on("clientupdate", function (client) {
  console.log("client updated: ", client);
});
server.on("clientquit", function (id) {
  console.log("Client with id: ", id, " has left the game.");
});
server.on("clienterror", function (client) {
  console.log("Client with id: ", client.id, " has had an error: ", client.err);
});

server.on("error", (error) => {
  if (error === "connectionclose") {
    console.log(
      `connection to ${process.env.SERVER}:${PORT} closed. Reconnecting in 5s.`
    );
    server.close();
    setTimeout(connect, 5000);
  } else {
    console.error("caught error", error);
  }
});

server.on("chat", function ({ action, desttype, id, message, money }) {
  const textCommandRespons = config.textCommands[message];

  console.log("received chat", id, message);

  if (textCommandRespons) {
    textCommandRespons.forEach((line) => server.sayClient(id, line));
    return;
  }

  if (message === "!reset") {
    server.rcon("clients").then((clients) => {
      const companyId = clients.find(
        (client) => client.id === Number(id)
      )?.company;

      if (!companyId || companyId === 255) {
        return server.sayClient(
          id,
          "You need to be a member of a company before you can reset it."
        );
      }
      const clientsInCompany = clients.filter(
        (client) => client.company === companyId
      ).length;
      if (clientsInCompany > 1) {
        return server.sayClient(
          id,
          "There are other people in this company. You can only reset it after they leave."
        );
      }
      server.rcon("move", `${id} 255`).then((res) => {
        console.log("move response", res);
        server.rcon("reset_company", companyId).then((lines) => {
          console.log("company has been reset", lines);
        });
      });
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

async function loop() {
  console.log("- running loop");
  const args = { server };

  await loopCleanCompanies(args);

  await loopResetGame(args);

  setTimeout(loop, 10000);
}
