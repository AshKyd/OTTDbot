import logger from "../log.mjs";

function parseCompanyLine(line) {
  const [
    ,
    id,
    colour,
    name,
    yearFounded,
    money,
    loan,
    value,
    trainCount,
    roadVehicleCount,
    planeCount,
    shipCount,
  ] =
    line.match(
      /#:(\d+)\((.*)\) Company Name: '(.*)'  Year Founded: (\d+)  Money: (-?\d+)  Loan: (\d+) .Value: (\d+)  \(T:(\d+), R:(\d+), P:(\d+), S:(\d+)\)/
    ) || [];

  if (!id) {
    console.error("could not parse company", JSON.stringify(line));
    return null;
  }

  const isProtected = !line.match(/unprotected$/);

  return {
    id: Number(id),
    colour,
    name,
    yearFounded: Number(yearFounded),
    money: Number(money),
    loan: Number(loan),
    value: Number(value),
    trainCount: Number(trainCount),
    roadVehicleCount: Number(roadVehicleCount),
    planeCount: Number(planeCount),
    shipCount: Number(shipCount),
    isProtected,
  };
}

export function companies(lines) {
  return lines.map(parseCompanyLine);
}

function parseClientLine(line) {
  const [, id, name, company, ip] =
    line.match(/Client #(\d+)  name: '(.*)'  company: (\d+)  IP: (.*)$/) || [];

  if (!id) {
    console.error("could not parse client", JSON.stringify(line), {
      id,
      name,
      company,
      ip,
    });
    return null;
  }

  return {
    id: Number(id),
    name,
    company: Number(company),
    ip,
  };
}

export function clients(lines) {
  return lines.map(parseClientLine);
}

export function reset_company(lines) {
  return { success: lines?.[0] === "Company deleted." };
}

export function move(lines) {
  return { success: lines?.[0]?.includes("has joined") };
}

export function setting(lines) {
  // E.g. Current value for 'vehicle.max_trains' is '1500' (min: 0, max: 5000).
  const match = lines[0].match(/Current value for '[^']+' is '([^']*)'/);
  console.log(lines[0], match);
  if (!match) {
    logger.error("Could not parse setting from line", lines);
    return null;
  }
  return match[1];
}
