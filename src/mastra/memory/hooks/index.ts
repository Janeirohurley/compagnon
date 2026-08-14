// Memory hooks for automatic retrieval and extraction
import { memoryManager } from "../manager";
import type { MemorySearchInput, RememberInput, EpisodeInput } from "../types";

export interface TaskContext {
  task: string;
  project?: string;
  repository?: string;
  files?: string[];
  tools?: string[];
}

// Pre-task: retrieve relevant memories before execution
export async function retrieveRelevantMemories(context: TaskContext): Promise<void> {
  const { task, project, repository, files } = context;
  
  // Search for relevant memories
  const searchInput: MemorySearchInput = {
    query: task,
    project,
    repository,
    types: ["semantic", "episode", "procedure", "decision"],
    minConfidence: 0.5,
    limit: 5,
  };

  const results = await memoryManager.search(searchInput);
  
  if (results.length > 0) {
    console.log(`[Memory] Retrieved ${results.length} relevant memories for task: "${task.substring(0, 30)}..."`);
    
    // Log what was retrieved for observability
    for (const result of results) {
      const typeLabel = result.type.toUpperCase();
      console.log(`[Memory]   - [${typeLabel}] ${result.id} (score: ${result.score.toFixed(2)})`);
    }
  }
}

// Post-task: extract and store valuable information after execution
export async function extractTaskMemories(
  context: TaskContext,
  outcome: {
    success: boolean;
    result?: string;
    error?: string;
    observations?: string[];
  }
): Promise<void> {
  const { task, project, repository, files, tools } = context;
  
  // Record episode
  const episodeInput: EpisodeInput = {
    project,
    repository,
    task: task.substring(0, 100),
    trigger: task.substring(0, 200),
    observations: outcome.observations || [],
    actions: tools || [],
    outcome: outcome.success 
      ? (outcome.result?.substring(0, 500) || "Task completed successfully")
      : (outcome.error?.substring(0, 500) || "Task failed"),
    success: outcome.success,
    toolsUsed: tools,
  };

  await memoryManager.recordEpisode(episodeInput);
  console.log(`[Memory] Recorded episode for: "${task.substring(0, 30)}..." (success: ${outcome.success})`);
}

// Extract facts from conversation/text
export async function extractFactsFromText(
  text: string,
  scope: "global" | "project" | "repository",
  scopeId?: string,
  sourceType: "conversation" | "file" | "tool" = "conversation"
): Promise<void> {
  // Simple heuristic extraction - in production, use LLM for extraction
  const facts = extractSimpleFacts(text);
  
  for (const fact of facts) {
    try {
      // Check for duplicates
      const conflicts = await memoryManager.detectConflicts({
        scope,
        scopeId,
        subject: fact.subject,
        predicate: fact.predicate,
        value: fact.value,
        confidence: 0.7,
        source: { type: sourceType },
      });

      if (conflicts.length > 0) {
        console.log(`[Memory] Conflict detected for: ${fact.subject} ${fact.predicate}`);
        // Don't store - conflict needs resolution
        continue;
      }

      await memoryManager.remember({
        scope,
        scopeId,
        subject: fact.subject,
        predicate: fact.predicate,
        value: fact.value,
        confidence: 0.7,
        source: { type: sourceType },
      });
      
      console.log(`[Memory] Extracted: ${fact.subject} ${fact.predicate} = ${fact.value}`);
    } catch (error) {
      console.error(`[Memory] Failed to extract fact:`, error);
    }
  }
}

// Simple pattern-based fact extraction
function extractSimpleFacts(text: string): Array<{subject: string; predicate: string; value: string}> {
  const facts: Array<{subject: string; predicate: string; value: string}> = [];
  
  // Pattern: "X uses Y" / "X is using Y"
  const usesPattern = /(\w+)\s+(?:uses|is using|uses|use)\s+([^\.]{2,100})/gi;
  let match;
  while ((match = usesPattern.exec(text)) !== null) {
    facts.push({
      subject: match[1],
      predicate: "uses",
      value: match[2].trim(),
    });
  }

  // Pattern: "X is located at Y"
  const locatedPattern = /(\w+)\s+(?:is located at|located at)\s+([^\.]{2,100})/gi;
  while ((match = locatedPattern.exec(text)) !== null) {
    facts.push({
      subject: match[1],
      predicate: "located at",
      value: match[2].trim(),
    });
  }

  // Pattern: "X is a/an Y"
  const isAPattern = /(\w+)\s+is\s+(?:a|an)\s+([^\.]{2,100})/gi;
  while ((match = isAPattern.exec(text)) !== null) {
    facts.push({
      subject: match[1],
      predicate: "is a",
      value: match[2].trim(),
    });
  }

  return facts;
}
