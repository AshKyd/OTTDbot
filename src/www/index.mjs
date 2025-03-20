import express from "express";
import basicAuth from "express-basic-auth";
import fs from "fs";
import cors from "cors";
import logger, { LOG_FILE } from "../log.mjs";

export default function startServer({ botServer }) {
  const app = express();

  app.use(cors());

  app.use(
    basicAuth({
      users: { admin: process.env.PASSWORD },
      challenge: true,
    })
  );
  const port = 3000;

  app.get("/", (req, res) => {
    res.send(`hi`);
  });
  app.get("/clients", async (req, res) => {
    await botServer.refreshClients();
    res.json(botServer.clients);
  });
  app.get("/afk", async (req, res) => {
    res.json(botServer.state.afk);
  });
  app.get("/clients/moderation/:action/:clientId", async (req, res) => {
    const { action, clientId } = req.params;
    const sanitisedId = Number(clientId);
    if (isNaN(sanitisedId) || sanitisedId < 1) {
      return res.json({ error: "invalid clientId" });
    }

    if (!["kick", "ban"].includes(action)) {
      return res.json({ error: "invalid action. Choose one of kick or ban" });
    }

    const rconResponse = await botServer.rcon(`${action} "${sanitisedId}"`);
    res.json({ status: rconResponse });
  });
  app.get("/clients/moderation/rename/:clientId/:newName", async (req, res) => {
    const { clientId, newName = "" } = req.params;
    const sanitisedId = Number(clientId);
    if (isNaN(sanitisedId) || sanitisedId < 1) {
      return res.json({ error: "invalid clientId" });
    }
    if (!newName.match(/^[a-zA-Z]+$/)) {
      return res.json({ error: "Invalid username. Alpha characters only." });
    }
    if (newName.length > 24) {
      return res.json({ error: "Invalid username. Max 24 characters." });
    }

    const rconResponse = await botServer.rcon(
      `client_name "${sanitisedId}" "${newName}"`
    );
    res.json({ status: rconResponse });
  });
  app.get("/say/client/:id", async (req, res) => {
    const botRes = await botServer.sayClient(req.params.id, req.query.message);
    res.json({ status: botRes.length === 1 });
  });
  app.get("/say/broadcast", async (req, res) => {
    const botRes = await botServer.say(req.query.message);
    res.json({ status: botRes.length === 1 });
  });
  app.get("/companies", async (req, res) => {
    const companies = await botServer.rcon("companies");
    res.json(companies);
  });
  app.get("/logs", (req, res) => {
    const logs = fs.readFileSync(LOG_FILE, "utf8");
    res.header("content-type", "text/plain");
    res.send(logs);
  });

  app.listen(port, () => {
    logger.log({
      level: "info",
      message: `App listening on port ${port}`,
    });
  });
}
