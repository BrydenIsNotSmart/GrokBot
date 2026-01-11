import { boolean, integer, pgTable, varchar, timestamp, primaryKey } from "drizzle-orm/pg-core";

export type ServerPremiumTier = "none" | "server_premium";

export const guilds = pgTable("guilds", {
  id: varchar().primaryKey().notNull(),
  icon: varchar(),
  blacklisted: boolean().default(false),
  commandsRan: integer().default(0),
  premiumTier: varchar().default("none"), // "none" | "server_premium"
  lastPromptDate: varchar(), // Stored as YYYY-MM-DD string for server-wide tracking
  promptsUsedToday: integer().default(0), // Server-wide prompt count for premium servers
});

// Table for per-user-per-server cooldowns
export const userServerCooldowns = pgTable("user_server_cooldowns", {
  userId: varchar().notNull(),
  serverId: varchar().notNull(),
  lastUsed: timestamp().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.serverId] }),
}));
