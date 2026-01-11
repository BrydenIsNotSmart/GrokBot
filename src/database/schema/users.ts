import { boolean, integer, varchar, pgTable } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: varchar().primaryKey().notNull(),
  commandsRan: integer().default(0),
  blacklisted: boolean().default(false),
});
