import { default as OpenTTDAdmin, enums } from "./openttdAdmin.mjs";
import { getRestartTime, loopResetGame } from "./loopResetGame.mjs";
import { loopCleanCompanies } from "./loopCleanCompanies.mjs";
import logger from "../log.mjs";
import { post } from "../mastodon/index.mjs";
import geoip from "geoip-lite";
import afk from "./commands/afk.mjs";

let server = new OpenTTDAdmin();

const PORT = process.env.SERVER_ADMIN_PORT || 3977;

server.on("connect", function () {
  server.authenticate("MyBot", process.env.PASSWORD);
});
server.on("welcome", async function (data) {
  await server.refreshClients();

  [enums.UpdateTypes.CLIENT_INFO, enums.UpdateTypes.CHAT].forEach(
    (updateType) =>
      server.send_update_frequency(
        updateType,
        enums.UpdateFrequencies.AUTOMATIC
      )
  );
  setTimeout(loop, 1000);
});

function getClient(id) {
  return {
    id: id,
    name: "Unknown",
    ip: "",
    lang: "",
    joinDate: 0,
    company: 255,
    ...server.clients[id],
  };
}

server.on("clientjoin", async function (id) {
  await server.refreshClients();
  const message = `client join: #${id} (${getClient(id).name}) has joined`;
  logger.info(message);
  server.config.welcomeMessage.forEach((line) => server.sayClient(id, line));
  post(message);
});

server.on("clientinfo", function ({ id, ip, name, lang, joindate, company }) {
  server.clients[id] = {
    ...server.clients[id],
    id,
    ip,
    name,
    lang,
    joindate,
    company,
  };
  logger.info(
    `client #${id} (${getClient(id).name}) has new info: ${JSON.stringify(
      server.clients[id]
    )}`
  );
});
server.on("clientupdate", function (client) {
  server.clients[client.id] = {
    ...server.clients[client.id],
    ...client,
  };
  logger.info(
    `client update: #${client.id} (${
      getClient(client.id).name
    }) has updated: ${JSON.stringify(client)}`
  );
});
server.on("clientquit", function (client) {
  const message = `client quit: #${client.id} (${
    getClient(client.id).name
  }) has quit`;
  logger.info(message);
  post(message);
  delete server.clients[client.id];
});
server.on("clienterror", function (client) {
  if (client.err === 3) {
    // standard quit error.
    return;
  }
  logger.info(
    `client error: client #${client.id} (${
      getClient(client.id).name
    }) has had error: ${client.err}`
  );
});

function connect() {
  logger.info(`connecting to ${process.env.SERVER}:${PORT}`);
  server.connect(process.env.SERVER, PORT);
}
server.on("error", (error) => {
  if (error === "connectionclose") {
    logger.error(
      `connection to ${process.env.SERVER}:${PORT} closed. Reconnecting in 5s.`
    );
    server.close();
    setTimeout(connect, 5000);
  } else {
    logger.error("received server error: ", JSON.stringify(error));
  }
});

server.on("chat", async function ({ action, desttype, id, message, money }) {
  const isPrivate = desttype !== enums.DestTypes.BROADCAST;

  const textCommandResponse = server.config.textCommands[message];

  const messageLog = `${isPrivate ? "DM from" : "from"} ${
    getClient(id).name
  } (#${id}): “${message}”${money ? ` (${money} money)` : ""}`;

  logger.log({
    level: "chat",
    message: messageLog,
  });

  if (!isPrivate) {
    post("Chat " + messageLog);
  }

  if (textCommandResponse) {
    logger.info(`command - responded to ${message} command`);
    textCommandResponse.forEach((line) => server.sayClient(id, line));
    return;
  }

  if (message === "!end") {
    const end = getRestartTime(server.config.game.restartHourUTC);
    // don't reply if the end has already begun
    if (end < 0) {
      return;
    }
    const relativeEnd = getRelativeEnd(end);
    const message = `This server resets in ${relativeEnd}`;
    if (isPrivate) {
      server.sayClient(id, message);
    } else {
      server.say(message);
    }
  }

  if (message === "!reset") {
    server.rcon("clients").then(async (clients) => {
      const companyId = clients.find(
        (client) => client.id === Number(id)
      )?.company;

      if (!companyId || companyId === 255) {
        logger.info(
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
        logger.info(
          `command reset: not resetting company with other members active`
        );
        return server.sayClient(
          id,
          "There are other people in this company. You can only reset it after they leave."
        );
      }

      try {
        logger.info(`command reset: resetting company ${companyId}`);
        const move = await server.rcon("move", `${id} 255`);
        const resetLines = await server.rcon("reset_company", companyId);

        logger.info(
          `command - company has been reset - ${resetLines.join(" - ")}`
        );
      } catch (e) {
        logger.info(
          `command reset: resetting company ${companyId} failed - e.message`
        );
      }
    });

    return;
  }

  await afk({ message, id, server, isPrivate });
});

/**
 * @param {number} end - When is the end date (unix time)
 */
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
  logger.info("running loop");
  const args = { server };

  if (i % 10 === 0) {
    await loopCleanCompanies(args);
  }

  await loopResetGame(args);

  setTimeout(loop, 10000);
}

/**
 * @param {object} config - Configuration for the server
 */
export default function startBot({ config }) {
  server.config = config;
  server.logger = logger;
  connect();
  return server;
}
