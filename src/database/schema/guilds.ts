import { boolean, integer, pgTable, varchar } from "drizzle-orm/pg-core";

export const guilds = pgTable("guilds", {
  id: varchar().primaryKey().notNull(),
  icon: varchar(),
  blacklisted: boolean().default(false),
  commandsRan: integer().default(0),
});
