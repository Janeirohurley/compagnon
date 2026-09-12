// Project persistence (feature-projects).
//
// A project is an element *of* a workspace: one workspace ("rundi nova") can
// hold several projects ("backend", "frontend", ...). Projects are stored in a
// workspaces-scoped table in the same LibSQL database as the rest of Compagnon
// and behave like a child collection of `workspaces`.
import { createClient, type Client } from "@libsql/client";

export const DEFAULT_PROJECT_STATUS = "active" as const;

export type ProjectStatus = "active" | "paused" | "archived";

export type Project = {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  description: string;
  projectPath: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
};

export type ProjectInput = {
  id?: string;
  workspaceId: string;
  name: string;
  slug?: string;
  description?: string;
  projectPath?: string;
  status?: ProjectStatus;
};

export type ProjectPatch = {
  name?: string;
  slug?: string;
  description?: string;
  projectPath?: string;
  status?: ProjectStatus;
};

const DB_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

function newClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN || undefined });
}

let db: Client | undefined;
let initialized: Promise<void> | undefined;

function instance(): Client {
  db ??= newClient();
  return db;
}

async function ready(): Promise<void> {
  initialized ??= (async () => {
    await instance().execute(`
      CREATE TABLE IF NOT EXISTS compagnon_projects (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        project_path TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await instance().execute(
      "CREATE INDEX IF NOT EXISTS idx_projects_workspace ON compagnon_projects (workspace_id)",
    );
  })();
  await initialized;
}

function rowToProject(row: Record<string, unknown>): Project {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    name: String(row.name),
    slug: String(row.slug),
    description: String(row.description || ""),
    projectPath: String(row.project_path || ""),
    status: (String(row.status) || DEFAULT_PROJECT_STATUS) as ProjectStatus,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export async function listProjects(workspaceId: string): Promise<Project[]> {
  await ready();
  const result = await instance().execute(
    "SELECT * FROM compagnon_projects WHERE workspace_id = ? ORDER BY created_at ASC",
    [workspaceId],
  );
  return (result.rows as Record<string, unknown>[]).map(rowToProject);
}

export async function getProject(id: string): Promise<Project | null> {
  await ready();
  const result = await instance().execute("SELECT * FROM compagnon_projects WHERE id = ?", [id]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToProject(row) : null;
}

export async function createProject(input: ProjectInput): Promise<Project> {
  await ready();
  const now = new Date().toISOString();
  const id = input.id || globalThis.crypto.randomUUID();
  const slug = input.slug || slugFromName(input.name);
  await instance().execute(
    `INSERT INTO compagnon_projects
      (id, workspace_id, name, slug, description, project_path, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.workspaceId,
      input.name,
      slug,
      input.description ?? "",
      input.projectPath ?? "",
      input.status ?? DEFAULT_PROJECT_STATUS,
      now,
      now,
    ],
  );
  return (await getProject(id)) as Project;
}

export async function updateProject(id: string, patch: ProjectPatch): Promise<Project | null> {
  await ready();
  const existing = await getProject(id);
  if (!existing) return null;

  const fields: Record<string, string> = {
    name: patch.name ?? existing.name,
    slug: patch.slug ?? existing.slug,
    description: patch.description ?? existing.description,
    project_path: patch.projectPath ?? existing.projectPath,
    status: patch.status ?? existing.status,
    updated_at: new Date().toISOString(),
  };
  const assign = Object.keys(fields)
    .map((key) => `${key} = ?`)
    .join(", ");
  await instance().execute(`UPDATE compagnon_projects SET ${assign} WHERE id = ?`, [
    ...Object.values(fields),
    id,
  ]);
  return (await getProject(id)) as Project;
}

export async function removeProject(id: string): Promise<boolean> {
  await ready();
  const result = await instance().execute("DELETE FROM compagnon_projects WHERE id = ?", [id]);
  return result.rowsAffected > 0;
}

function slugFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "project"
  );
}