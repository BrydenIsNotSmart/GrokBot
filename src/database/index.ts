import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { DATABASE_URL } from "../config";

export const db = drizzle({
  connection: {
    connectionString: DATABASE_URL,
    ssl: false,
  },
  schema: schema,
});

await db.execute("select 1");
