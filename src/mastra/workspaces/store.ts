// Workspace persistence (TASK-002).
//
// A `workspaces` table in the *same* LibSQL database as the rest of Compagnon
// (TURSO_DATABASE_URL / TURSO_AUTH_TOKEN, defaults to `file:./mastra.db`).
// Tenancy stays key-based; we never spawn separate databases for the level
// 1->2 isolation of this plan.
import { createClient, type Client } from "@libsql/client";
import { getDefaultChatRef } from "../providers/resolve";
import {
  DEFAULT_WORKSPACE_ID,
  ALL_ENABLED_AGENTS,
  type Workspace,
  type WorkspaceConfig,
  type WorkspaceStore,
} from "./types";

const DB_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

function newClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN || undefined });
}

const defaultConfig = (): WorkspaceConfig => ({
  projectPath: process.cwd(),
  enabledAgents: [...ALL_ENABLED_AGENTS],
  model: undefined,
  instructions: undefined,
});

let db: Client | undefined;
let initialized: Promise<void> | undefined;

function instance(): Client {
  db ??= newClient();
  return db;
}

async function ready(): Promise<void> {
  initialized ??= (async () => {
    const c = instance();
    await c.execute(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        config TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
  })();
  await initialized;
}

function rowToWorkspace(row: Record<string, unknown>): Workspace {
  const cfg = JSON.parse(String(row.config || "{}")) as WorkspaceConfig;
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    config: cfg,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Idempotent bootstrap: creates the `default` workspace from env on first use. */
async function bootstrap(): Promise<void> {
  const c = instance();
  const existing = await c.execute("SELECT id FROM workspaces WHERE id = ?", [DEFAULT_WORKSPACE_ID]);
  if ((existing.rows[0] as { id?: string } | undefined)?.id) return;

  const now = new Date().toISOString();
  const config = defaultConfig();
  // Workspace model records only the identity (providerId/modelId); url and
  // apiKey are resolved at use-time from the provider registry (resolve.ts).
  const model = getDefaultChatRef();
  config.model = { providerId: model.providerId, modelId: model.modelId };

  await c.execute(
    `INSERT INTO workspaces (id, name, slug, config, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      DEFAULT_WORKSPACE_ID,
      "Default",
      "default",
      JSON.stringify(config),
      now,
      now,
    ],
  );
}

const store: WorkspaceStore = {
  async get(id) {
    await ready();
    await bootstrap();
    const result = await instance().execute("SELECT * FROM workspaces WHERE id = ?", [id]);
    const row = result.rows[0] as Record<string, unknown> | undefined;
    return row ? rowToWorkspace(row) : null;
  },

  async list() {
    await ready();
    await bootstrap();
    const result = await instance().execute("SELECT * FROM workspaces ORDER BY created_at ASC");
    return (result.rows as Record<string, unknown>[]).map(rowToWorkspace);
  },

  async create({ id, name, slug, config }) {
    await ready();
    await bootstrap();
    const now = new Date().toISOString();
    await instance().execute(
      `INSERT INTO workspaces (id, name, slug, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, slug, JSON.stringify(config), now, now],
    );
    return (await store.get(id)) as Workspace;
  },
};

export const workspaceStore: WorkspaceStore = store;

export async function listWorkspaces(): Promise<Workspace[]> {
  return store.list();
}

export async function getWorkspace(id: string): Promise<Workspace | null> {
  return store.get(id);
}

export async function createWorkspace(input: {
  id: string;
  name: string;
  slug: string;
  config?: Partial<WorkspaceConfig>;
}): Promise<Workspace> {
  const base = defaultConfig();
  const config: WorkspaceConfig = {
    projectPath: input.config?.projectPath ?? base.projectPath,
    enabledAgents: input.config?.enabledAgents ?? base.enabledAgents,
    model: input.config?.model ?? base.model,
    instructions: input.config?.instructions ?? base.instructions,
  };
  return store.create({
    id: input.id,
    name: input.name,
    slug: input.slug,
    config,
  });
}