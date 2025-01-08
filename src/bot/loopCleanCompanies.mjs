import { formatDistance } from "date-fns";

let companies = {};

export async function loopCleanCompanies({ server }) {
  const idleMinutes = server.config.game?.idleCompanyAgeMinutes;
  if (!idleMinutes) {
    console.log("not handling idle idleCompanyAgeMinutes");
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
