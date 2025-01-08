import startServer from "./www/index.mjs";
import config from "../config.json" assert { type: "json" };
import startBot from "./bot/index.mjs";

const botServer = await startBot({ config });

startServer({ botServer });
