import { addHours } from "date-fns";
import config from "../config.json" assert { type: "json" };

let lastRestart = 0;
let warnings = [];
function isWithin(value, lower, upper) {
  return value > lower && value < upper;
}

export function getRestartTime() {
  const restartHourUTC = config.game.restartHourUTC;
  const now = new Date();
  let restartDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      restartHourUTC,
      0
    )
  );
  if (now.getUTCHours() >= restartHourUTC) {
    restartDate = addHours(restartDate, 24);
  }

  return Number(restartDate) - Date.now();
}

const ONE_MINUTE = 1000 * 60;
export function loopResetGame({ server }) {
  if (Date.now() - lastRestart < ONE_MINUTE * 60) {
    return;
  }
  const restartTime = getRestartTime();
  if (
    !warnings.includes("5min") &&
    isWithin(restartTime, ONE_MINUTE * 3, ONE_MINUTE * 5)
  ) {
    warnings.push("5min");
    server.say("This server will reset in 5 minutes");
    server.say(
      "If you want to keep your work, now is the time to save your game or take any screenshots"
    );
  }
  if (
    !warnings.includes("1min") &&
    isWithin(restartTime, ONE_MINUTE / 2, ONE_MINUTE)
  ) {
    server.say("This server will reset in 1 minute");
    server.say("We hope you join us for the next game");
    warnings.push("1min");
  }

  if (!warnings.includes("countdown") && restartTime <= 1000 * 10) {
    warnings.push("countdown");
    let countdown = 10;
    const interval = setInterval(() => {
      if ([10, 5, 4, 3, 2].includes(countdown)) {
        server.say(`Resetting in ${countdown}`);
      }

      if (countdown === 1) {
        server.say("Server is resetting. Join for the next game…");
        clearInterval(interval);
        setTimeout(() => {
          server.rcon("newgame").then(() => {
            lastRestart = Date.now();
            warnings = [];
          });
        }, 2000);
      }
      countdown--;
    }, 1000);
  }
}
