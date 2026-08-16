// Episode Repository - Data access layer
import { memoryDb, initializeMemoryDatabase } from "../storage/client";
import type { Episode } from "../domain/types";

export async function createEpisode(episode: Omit<Episode, "createdAt">): Promise<Episode> {
  await initializeMemoryDatabase();

  const now = new Date().toISOString();
  await memoryDb.execute(
    `INSERT INTO episodes 
      (id, project, repository, task, trigger, observations, actions, outcome, success, lessons, tools_used, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      episode.id, episode.project || null, episode.repository || null, episode.task || null,
      episode.trigger, JSON.stringify(episode.observations), JSON.stringify(episode.actions),
      episode.outcome, episode.success ? 1 : 0, episode.lessons ? JSON.stringify(episode.lessons) : null,
      episode.toolsUsed ? JSON.stringify(episode.toolsUsed) : null, now
    ] as (string | number | Uint8Array)[]
  );

  return { ...episode, createdAt: new Date(now) };
}

export async function findEpisodeById(id: string): Promise<Episode | null> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute("SELECT * FROM episodes WHERE id = ?", [id]);

  if (!result.rows?.length) return null;
  return mapRowToEpisode(result.rows[0] as Record<string, unknown>);
}

export async function findEpisodesByProject(project: string): Promise<Episode[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM episodes WHERE project = ? ORDER BY created_at DESC",
    [project]
  );

  return result.rows?.map(row => mapRowToEpisode(row as Record<string, unknown>)) || [];
}

export async function findEpisodesByRepository(repository: string): Promise<Episode[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM episodes WHERE repository = ? ORDER BY created_at DESC",
    [repository]
  );

  return result.rows?.map(row => mapRowToEpisode(row as Record<string, unknown>)) || [];
}

export async function findRecentEpisodes(limit = 10): Promise<Episode[]> {
  await initializeMemoryDatabase();
  const result = await memoryDb.execute(
    "SELECT * FROM episodes ORDER BY created_at DESC LIMIT ?",
    [limit]
  );

  return result.rows?.map(row => mapRowToEpisode(row as Record<string, unknown>)) || [];
}

export async function deleteEpisodeById(id: string): Promise<void> {
  await initializeMemoryDatabase();
  await memoryDb.execute("DELETE FROM episodes WHERE id = ?", [id]);
}

function mapRowToEpisode(row: Record<string, unknown>): Episode {
  return {
    id: String(row.id),
    project: row.project ? String(row.project) : undefined,
    repository: row.repository ? String(row.repository) : undefined,
    task: row.task ? String(row.task) : undefined,
    trigger: String(row.trigger),
    observations: JSON.parse(String(row.observations)),
    actions: JSON.parse(String(row.actions)),
    outcome: String(row.outcome),
    success: Boolean(row.success),
    lessons: row.lessons ? JSON.parse(String(row.lessons)) : undefined,
    toolsUsed: row.tools_used ? JSON.parse(String(row.tools_used)) : undefined,
    createdAt: new Date(String(row.created_at)),
  };
}
