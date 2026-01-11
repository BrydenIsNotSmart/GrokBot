import { boolean, integer, varchar, pgTable } from "drizzle-orm/pg-core";

export type PremiumTier = "none" | "user_premium";

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
  commandsRan: integer().default(0),
  blacklisted: boolean().default(false),
  isPremium: boolean().default(false), // Legacy field, kept for backwards compatibility
  premiumTier: varchar().default("none"), // "none" | "user_premium"
  preferredModel: varchar().default("grok-4-fast-non-reasoning"), // Model preference for premium users
  lastPromptDate: varchar(), // Stored as YYYY-MM-DD string
  promptsUsedToday: integer().default(0),
});
