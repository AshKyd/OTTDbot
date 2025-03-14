import { connection as libOpenttdAdmin, enums } from "node-openttd-admin-class";
import * as rconParsers from "./rconParsers.mjs";
import fs from "fs";
import geoip from "geoip-lite";
import logger from "../log.mjs";

function rconEscape(string) {
  return `"${string.replace(/"/g, `'`)}"`;
}

export default class OpenTTDAdmin extends libOpenttdAdmin {
  commands = [];
  clients = {};
  state = {};
  #isRunningCommand = false;
  constructor() {
    super();
    try {
      const { state, clients } = JSON.parse(
        fs.readFileSync(process.env.CONFIG_PATH || "state.json")
      );
      this.clients = clients || {};
      this.state = state || {};
    } catch (e) {
      logger.error("Could not load state: " + e.message);
    }
  }

  /**
   * @param {string} message - message to broadcast publicly
   */
  say(message) {
    this.send_rcon(`say ${rconEscape(message)}`);
  }

  /**
   * @param {number} id - recipient client for this message
   * @param {string} message - message to send to the given user
   */
  sayClient(id, message) {
    this.send_rcon(`say_client ${id} ${rconEscape(message)}`);
  }

  #runCommand() {
    this.#isRunningCommand = true;
    const [command, args, resolve, reject] = this.commands.shift();
    this.logger.info("running command - " + command);

    this.send_rcon([command, args].filter(Boolean).join(" "));

    const messages = [];
    let error = null;

    const timeout = setTimeout(() => {
      error = new Error("rcon timeout - rconend not received");
      onEnd();
    }, 5000);

    function onMessage({ output }) {
      messages.push(output);
    }

    const onEnd = () => {
      this.off("rcon", onMessage);
      this.off("rconend", onEnd);
      clearTimeout(timeout);

      if (error) {
        reject(error);
      } else {
        const parser = rconParsers[command];
        let res = parser ? parser(messages) : messages;
        resolve(res);
      }
      this.logger.info("finished command - " + command);

      if (this.commands.length) {
        this.#runCommand();
      } else {
        this.#isRunningCommand = false;
      }
    };
    this.on("rcon", onMessage);
    this.once("rconend", onEnd);
  }
  /**
   * Run an rcon command and await the response.
   * @param {string} command - command to run, e.g. reset_company
   * @param {string=} args - arguments for this command, e.g. "2"
   */
  rcon(command, args) {
    let resolve, reject;
    const p = new Promise((_resolve, _reject) => {
      resolve = _resolve;
      reject = _reject;
    });
    this.commands.push([command, args, resolve, reject]);
    if (!this.#isRunningCommand) {
      this.#runCommand();
    }
    return p;
  }

  async refreshClients() {
    const clients = await this.rcon("clients");
    clients.forEach((client) => {
      const lookup = geoip.lookup(client.ip);
      const thisClientInfo = {
        ...this.clients[client.id],
        ...client,
        geo: client.ip !== "server" ? lookup?.country || "unknown" : "server",
      };
      this.clients[client.id] = thisClientInfo;
    });
    this.syncState();
  }

  syncState() {
    try {
      fs.writeFileSync(
        process.env.CONFIG_PATH || "state.json",
        JSON.stringify({
          state: this.state,
          clients: this.clients,
        })
      );
    } catch (e) {
      logger.error("Could not write state: " + e.message);
    }
  }
}

export { enums } from "node-openttd-admin-class";
