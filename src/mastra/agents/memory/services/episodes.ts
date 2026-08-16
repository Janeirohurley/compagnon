// Episode Service - uses episode-repository
import {
  findEpisodeById,
  findEpisodesByProject,
  findEpisodesByRepository,
  findRecentEpisodes,
  deleteEpisodeById,
} from "../repositories/episode-repository";
import type { Episode } from "../domain/types";

export async function getEpisode(id: string): Promise<Episode | null> {
  return findEpisodeById(id);
}

export async function listEpisodes(project?: string, repository?: string): Promise<Episode[]> {
  if (repository) {
    return findEpisodesByRepository(repository);
  }
  if (project) {
    return findEpisodesByProject(project);
  }
  return findRecentEpisodes(50);
}

export async function deleteEpisode(id: string): Promise<void> {
  await deleteEpisodeById(id);
}
