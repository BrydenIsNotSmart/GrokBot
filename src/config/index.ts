import { ActivityType } from "discord.js";

//-BOT-//
export const botToken = Bun.env.BOT_TOKEN;
export const clientId = Bun.env.CLIENT_ID;
export const guildId = Bun.env.GUILD_ID;
export const embedColor = "#FFFFFF";
export const DEVELOPER_ID = "529815278456930314";
export const COOLDOWN_MS = 3000;
export const newGuildsChannelId = "1427196989623373874";

export const CUSTOM_STATUSES = [
  { text: "the universe think 🤔", type: ActivityType.Watching },
  { text: "your questions unfold ⚡", type: ActivityType.Watching },
  { text: "for the right answer 🔍", type: ActivityType.Listening },
  { text: "context and nuance 🧠", type: ActivityType.Playing },
  { text: "patterns in chaos 🌀", type: ActivityType.Watching },
  { text: "truth from noise 📡", type: ActivityType.Playing },
  { text: "ideas collide 💥", type: ActivityType.Watching },
  { text: "logic at light speed 🚀", type: ActivityType.Playing },
  { text: "the internet think 🌐", type: ActivityType.Listening },
  { text: "your curiosity grow ✨", type: ActivityType.Watching },
];

export const STATUS_UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes

//-DATABASE-//
export const DATABASE_URL = Bun.env.DATABASE_URL;

//-XAI API-//
export const XAI_API_KEY = Bun.env.XAI_API_KEY;

// Validate required environment variables on startup
if (!botToken) {
  throw new Error("BOT_TOKEN environment variable is required");
}

if (!clientId) {
  throw new Error("CLIENT_ID environment variable is required");
}

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

if (!XAI_API_KEY) {
  throw new Error("XAI_API_KEY environment variable is required");
}
