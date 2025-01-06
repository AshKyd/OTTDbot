import { connection as libOpenttdAdmin, enums } from "node-openttd-admin-class";
import * as rconParsers from "./rconParsers.mjs";

function rconEscape(string) {
  return `"${string.replace(/"/g, `'`)}"`;
}

export default class OpenTTDAdmin extends libOpenttdAdmin {
  commands = [];
  #isRunningCommand = false;
  constructor() {
    super();
  }

  say(message) {
    this.send_rcon(`say ${rconEscape(message)}`);
  }

  sayClient(id, message) {
    this.send_rcon(`say_client ${id} ${rconEscape(message)}`);
  }

  #runCommand() {
    this.#isRunningCommand = true;
    const [command, args, resolve, reject] = this.commands.shift();
    console.log(" - running command", command);

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

    function onEnd() {
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
      console.log(" - finished command", command);

      if (this.commands.length) {
        this.#runCommand();
      } else {
        this.#isRunningCommand = false;
      }
    }
    this.on("rcon", onMessage);
    this.once("rconend", onEnd);
  }
  /**
   * Run an rcon command and await the response.
   * @params {string} command - command to run, e.g. reset_company
   * @params {string=} args - arguments for this command, e.g. "2"
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
}

export { enums } from "node-openttd-admin-class";
