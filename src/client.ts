import {
  Collection,
  Client,
  REST,
  Routes,
  GatewayIntentBits,
} from "discord.js";
import { readdirSync } from "fs";
import { join } from "path";
import { botToken, clientId, guildId } from "./config/index.ts";
import { ClusterClient, getInfo, messageType } from "discord-hybrid-sharding";

declare module "discord.js" {
  interface Client {
    cluster?: ClusterClient;
  }
}

export const cooldown = new Map<string, number>();
export let slashcommands: Collection<string, any>;

import "./database";

export const client = new Client({
  shards: getInfo().SHARD_LIST,
  shardCount: getInfo().TOTAL_SHARDS,
  allowedMentions: {
    repliedUser: false,
  },
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.cluster = new ClusterClient(client);
client.cluster.on("message", (message) => {
  console.log(message);
  if (typeof message !== "object" || message === null || !("_type" in message))
    return;
  const m = message as any;
  if (m._type !== messageType.CUSTOM_REQUEST) return;
  if (m.alive) m.reply({ content: "Yes I am!" });
});
setInterval(() => {
  client.cluster?.send({ content: "I am alive as well!" });
}, 5000);

//-Events-//
const eventsPath = join(__dirname, "events");
const eventFiles = readdirSync(eventsPath).filter(
  (file) => file.endsWith(".ts") || file.endsWith(".js"),
);

for (const file of eventFiles) {
  const filePath = join(eventsPath, file);
  const eventModule = await import(filePath);
  const event = eventModule.default;

  if (event.once) {
    client.once(event.name, (...args) => event.execute(...args, client));
  } else {
    client.on(event.name, (...args) => event.execute(...args, client));
  }
}

//-Slash Commands-//
slashcommands = new Collection();
const slashPath = join(__dirname, "slashcommands");
const slashFiles = readdirSync(slashPath).filter(
  (file) => file.endsWith(".ts") || file.endsWith(".js"),
);

const commandData: any[] = [];
for (const file of slashFiles) {
  const filePath = join(slashPath, file);
  const slashModule = await import(filePath);
  const command = slashModule.default;

  if ("data" in command && "execute" in command) {
    slashcommands.set(command.data.name, command);
    commandData.push(command.data.toJSON());
  } else {
    console.warn(
      `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
    );
  }
}

const rest = new REST({ version: "10" }).setToken(botToken!);

try {
  console.log(`[INFO] Registering slash commands...`);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId!, guildId), {
      body: commandData,
    });
    console.log(
      `[INFO] Successfully registered ${commandData.length} guild slash commands.`,
    );
  } else {
    await rest.put(Routes.applicationCommands(clientId!), {
      body: commandData,
    });
    console.log(
      `[INFO] Successfully registered ${commandData.length} global slash commands.`,
    );
  }
} catch (error) {
  console.error("Failed to register slash commands:", error);
}

client.login(botToken);
