import { db } from "../database";

export async function getDatabasePing(): Promise<number> {
  const start = Date.now();
  await db.execute("select 1");
  const end = Date.now();
  return end - start;
}
