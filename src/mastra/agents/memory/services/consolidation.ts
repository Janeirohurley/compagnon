// Memory consolidation - turn repeated episodes into procedures
import { findEpisodesByProject } from "../repositories/episode-repository";
import { findMemoriesByScope, archiveMemoryById, findStaleMemories as findStaleMemoriesFromRepo } from "../repositories/memory-repository";
import { createProcedure } from "./procedures";
export interface ConsolidationInput {
  project?: string;
  repository?: string;
  minEpisodes?: number;
}

export interface ConsolidationResult {
  proceduresCreated: number;
  episodesConsolidated: number;
  details: string[];
}

// Consolidate repeated episodes into procedures
export async function consolidateEpisodes(input: ConsolidationInput): Promise<ConsolidationResult> {
  const { project, minEpisodes = 3 } = input;

  const episodes = project ? await findEpisodesByProject(project) : [];
  
  // Group by trigger similarity
  const groups = new Map<string, typeof episodes>();
  
  for (const episode of episodes) {
    // Simple grouping by first 50 chars of trigger
    const key = episode.trigger.substring(0, 50).toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(episode);
  }

  const result: ConsolidationResult = {
    proceduresCreated: 0,
    episodesConsolidated: 0,
    details: [],
  };

  for (const [key, group] of groups) {
    if (group.length < minEpisodes) continue;
    
    // Check success rate
    const successCount = group.filter(e => e.success).length;
    const successRate = successCount / group.length;
    
    if (successRate < 0.5) continue; // Don't create procedure from failed attempts

    // Create procedure from most successful episode
    const best = group.find(e => e.success) || group[0];
    
    const procedure = await createProcedure({
      name: `handle_${key.replace(/[^a-z0-9]/g, '_')}`,
      purpose: best.outcome.substring(0, 200),
      prerequisites: [],
      steps: best.actions.map((action, i) => ({
        order: i + 1,
        action,
      })),
      failureModes: best.lessons?.map(l => ({
        symptom: "failure",
        diagnosis: l,
        resolution: "review the episode",
      })),
    });

    result.proceduresCreated++;
    result.episodesConsolidated += group.length;
    result.details.push(`Created procedure "${procedure.name}" from ${group.length} episodes`);
  }

  console.log(`[Memory] Consolidation: ${result.proceduresCreated} procedures, ${result.episodesConsolidated} episodes`);
  return result;
}

// Check for stale memories (not verified in X days)
export async function findStaleMemories(daysThreshold = 30): Promise<string[]> {
  const memories = await findStaleMemoriesFromRepo(daysThreshold);
  return memories.map(m => m.id);
}

// Auto-archive very old memories
export async function archiveStaleMemories(daysThreshold = 90): Promise<number> {
  const memories = await findMemoriesByScope("global");
  let archived = 0;
  const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;

  for (const memory of memories) {
    const lastUsed = memory.lastUsedAt?.getTime() || memory.updatedAt.getTime();
    if (lastUsed < threshold && memory.status === "active") {
      await archiveMemoryById(memory.id);
      archived++;
    }
  }

  console.log(`[Memory] Archived ${archived} stale memories`);
  return archived;
}
