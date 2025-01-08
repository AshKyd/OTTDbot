import winston from "winston";

export const LOG_FILE = "/tmp/combined.log";

const myCustomLevels = {
  levels: {
    chat: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  colors: {
    chat: "blue",
    info: "yellow",
    warn: "purple",
    error: "red",
  },
};

const logger = winston.createLogger({
  levels: myCustomLevels.levels,
  level: "info",
  format: winston.format.simple(),
  defaultMeta: { service: "user-service" },
  transports: [
    //
    // - Write all logs with importance level of `error` or higher to `error.log`
    //   (i.e., error, fatal, but not other levels)
    //
    new winston.transports.File({ filename: "/tmp/error.log", level: "error" }),
    //
    // - Write all logs with importance level of `info` or higher to `combined.log`
    //   (i.e., fatal, error, warn, and info, but not trace)
    //
    new winston.transports.File({ filename: LOG_FILE }),

    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});
winston.addColors(myCustomLevels.colors);

export default logger;
