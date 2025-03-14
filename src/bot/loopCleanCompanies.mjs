import { formatDistance } from "date-fns";
import logger from "../log.mjs";
import { cleanAfk } from "./commands/afk.mjs";

let companies = {};

export async function loopCleanCompanies({ server }) {
  cleanAfk(server);
  const idleMinutes = server.config.game?.idleCompanyAgeMinutes;
  if (!idleMinutes) {
    logger.info("not handling idle idleCompanyAgeMinutes");
    return;
  }
  const resCompanies = await server.rcon("companies");
  const resClients = await server.rcon("clients");
  const newCompanies = {};
  resCompanies.forEach((company) => {
    const existingCompany = companies[company.id];

    const isPopulated = resClients.some(
      (client) => client.company === company.id
    );

    const lastPopulated = isPopulated
      ? Date.now()
      : existingCompany?.lastPopulated || Date.now();

    if (lastPopulated < Date.now() - idleMinutes * 60 * 1000) {
      const afkTime = server.state.afk?.[company.id];
      if (afkTime) {
        logger.info(
          `company ${existingCompany.name} is AFK for ${formatDistance(
            new Date(),
            new Date(afkTime)
          )} and won't be cleared`
        );
        return;
      }

      const timeAgoFormatted = formatDistance(
        new Date(lastPopulated),
        new Date()
      );
      server.say(
        `Company "${company.name}" has been abandoned for ${timeAgoFormatted} and will be shut down.`
      );
      setTimeout(() => server.rcon("reset_company", company.id), 2000);
    }
    const newDef = {
      name: company.name,
      lastPopulated,
    };
    newCompanies[company.id] = newDef;
  });

  companies = newCompanies;
}
