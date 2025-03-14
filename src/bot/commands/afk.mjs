import logger from "../../log.mjs";
import { formatDistance } from "date-fns";

export function cleanAfk(server) {
  server.state.afk = Object.entries(server.state.afk || {}).reduce(
    (obj, [companyId, time]) => {
      if (time >= Date.now()) {
        obj[companyId] = time;
      }
      return obj;
    },
    {}
  );
}

export default async function afk({ message, id, server, isPrivate }) {
  const client = server.clients[id];
  if (message === "!back") {
    logger.log({
      level: "info",
      message: `${client.name} is back, removing afk`,
    });
    delete server.state.afk?.[client.company];
    server.say(`Welcome back, ${client.name}`);
    return;
  }

  if (!message.match(/^\!afk/)) {
    return;
  }

  const [, time, units = "h"] = message.match(/\!afk (\d+)(\w)?/) || [];

  if (message === "!afk") {
    cleanAfk(server);
    const resCompanies = await server.rcon("companies");
    server.sayClient(
      id,
      `Set yourself away with "!afk <time>", betwen 1m and 9h. Use "!back" when you come back. AFK companies will not be cleared.`
    );
    Object.entries(server.state.afk).forEach(([companyId, afkTime]) => {
      const company = resCompanies.find(
        (thisCompany) => thisCompany?.id === Number(companyId)
      );
      if (!company) {
        logger.error(
          `Company ${companyId} exists in AFK but not in company list`
        );
        return;
      }
      server.sayClient(
        id,
        `${company.name} - back in ${formatDistance(
          new Date(),
          new Date(afkTime)
        )}`
      );
    });

    if (!Object.keys(server.state.afk).length) {
      server.sayClient(id, "No companies are AFK.");
    }
    return;
  }
  const distance = time * 1000 * 60 * (units === "h" ? 60 : 1);
  const EIGHT_HOURS = 1000 * 60 * 60 * 9;
  if (distance > EIGHT_HOURS) {
    server.sayClient(
      id,
      "The maximum AFK time is 9 hours, please try a lower time."
    );
    return;
  }
  const afkTime = Date.now() + distance;
  server.state.afk = {
    ...server.state.afk,
    [client.company]: afkTime,
  };
  const timeRelative = formatDistance(new Date(), new Date(afkTime)).replace(
    "about",
    ""
  );
  server.say(
    `${client.name} will be !afk for ${timeRelative}. Their company will not be cleared.`
  );
  logger.info(
    `${client.name} set company ${client.company} AFK for ${timeRelative}`
  );
  server.syncState();
}
