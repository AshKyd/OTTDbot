import OpenTTDAdmin from "./openttd-admin-client/src/index.js";

const client = OpenTTDAdmin({
  host: "localhost",
  port: 3977,
  debug: 1,
});

await client.connect();
const response = await client.auth({
  user: "AdminUser",
  password: "t27ciZAE4HQbRYKV",
});

let lines;

// console.log({ response });

lines = await client.rcon.clients();
console.log(lines);

lines = await client.rcon.companies();
console.log(lines);

// lines = await client.rcon.echo({ text: "foo bar baz" });
// console.log(lines);

// lines = await client.rcon.listPatches();
// console.log(lines);

// lines = await client.rcon.pwd();
// console.log(lines);

// lines = await client.rcon.serverInfo();
// console.log(lines);

// lines = await client.rcon.status();
// console.log(lines);

lines = await client.rcon.say({ text: "Hello world" });
