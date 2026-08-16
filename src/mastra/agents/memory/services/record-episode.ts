import { createEpisode } from "../repositories/episode-repository";
import type { EpisodeInput, Episode } from "../domain/types";

export async function recordEpisode(input: EpisodeInput): Promise<Episode> {
  const id = crypto.randomUUID();

  return createEpisode({
    id,
    project: input.project,
    repository: input.repository,
    task: input.task,
    trigger: input.trigger,
    observations: input.observations,
    actions: input.actions,
    outcome: input.outcome,
    success: input.success,
    lessons: input.lessons,
    toolsUsed: input.toolsUsed,
  });
}
