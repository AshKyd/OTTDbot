import logger from "../../log.mjs";
import { formatDistance } from "date-fns";

export function cleanAfk(server) {
  server.afk = Object.entries(server.afk || {}).reduce(
    (obj, [companyId, time]) => {
      if (time <= Date.now()) {
        obj[companyId] = time;
      }
      return obj;
    },
    {}
  );
}

export default async function afk({ message, id, server }) {
  if (!message.match(/^\!afk/)) {
    return;
  }

  const { company } = server.clients.find((thisClient) => thisClient.id === id);

  const [, time, units = "h"] = message.match(/\!afk (\d+)(\w?)/) || [];

  if (message === "!afk") {
    cleanAfk(server);
    const resCompanies = await server.rcon("companies");

    Object.entries(server.afk).forEach((companyId, afkTime) => {
      const company = resCompanies.find(
        (thisCompany) => thisCompany.id === companyId
      );
      server.sayClient(
        id,
        `${company.name} is AFK and will be back in ${formatDistance(
          new Date(),
          new Date(afkTime)
        )}`
      );
    });

    if (!Object.keys(company.length)) {
      server.sayClient(
        id,
        'No companies are AFK. Set yourself away with "!afk 2h"'
      );
    }
    return;
  }

  const afkTime = Date.now() + time * 1000 * 60 * (units === "h" ? 60 : 1);
  server.afk = {
    ...server.afk,
    [company]: afkTime,
  };
}
