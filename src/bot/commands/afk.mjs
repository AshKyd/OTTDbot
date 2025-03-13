import logger from "../../log.mjs";
import { formatDistance } from "date-fns";

export function cleanAfk(server) {
  server.afk = Object.entries(server.afk || {}).reduce(
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
    delete server.afk?.[client.company];
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
    Object.entries(server.afk).forEach(([companyId, afkTime]) => {
      const company = resCompanies.find(
        (thisCompany) => thisCompany.id === Number(companyId)
      );
      server.sayClient(
        id,
        `${company.name} is AFK and will be back in ${formatDistance(
          new Date(),
          new Date(afkTime)
        )}`
      );
    });

    if (!Object.keys(server.afk).length) {
      server.sayClient(
        id,
        'No companies are AFK. Set yourself away with "!afk 2h"'
      );
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
  server.afk = {
    ...server.afk,
    [client.company]: afkTime,
  };
  const timeRelative = formatDistance(new Date(), new Date(afkTime)).replace(
    "about",
    ""
  );
  server.sayClient(
    id,
    `You have been marked AFK for ${timeRelative}. Your company will not be cleared.`
  );
  logger.info(
    `${client.name} set company ${client.company} AFK for ${timeRelative}`
  );
}
