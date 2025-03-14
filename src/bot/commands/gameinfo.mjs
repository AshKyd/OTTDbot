export default async function gameinfo({ message, server }) {
  if (message !== "!gameinfo") {
    return;
  }
  const [maxTrains, maxPlanes, maxVehicles, maxShips, trainLength, breakdowns] =
    await Promise.all([
      server.rcon("setting", "max_trains"),
      server.rcon("setting", "max_aircraft"),
      server.rcon("setting", "max_roadveh"),
      server.rcon("setting", "max_ships"),
      server.rcon("setting", "max_train_length"),
      server.rcon("setting", "vehicle_breakdowns"),
    ]);

  const breakdownMap = {
    0: "off",
    1: "reduced",
    2: "normal setting",
  };

  await server.say(`Max trains: ${maxTrains} | Train length: ${trainLength}`);
  await server.say(
    `Vehicles: ${maxVehicles} | Ships: ${maxShips} | Planes: ${maxPlanes}`
  );
  await server.say(
    `Breakdowns are ${breakdownMap[breakdowns] || "indeterminate"}.`
  );
}
