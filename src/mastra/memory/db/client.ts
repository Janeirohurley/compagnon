// Turso/SQLite client for memory persistence
import { createClient } from "@libsql/client";

const TURSO_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

export const memoryDb = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN,
});

export async function initializeMemoryDatabase(): Promise<void> {
  const { SQL_SCHEMA } = await import("./schema");
  
  const statements = SQL_SCHEMA.split(";").filter(s => s.trim());
  
  for (const stmt of statements) {
    if (stmt.trim()) {
      await memoryDb.execute(stmt);
    }
  }
  
  console.log("[Memory] Database initialized");
}
