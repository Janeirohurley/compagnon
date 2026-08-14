// Memory tools exposed to the agent
import { memoryManager } from "../manager";
import { z } from "zod";

const searchSchema = z.object({
  query: z.string().describe("The search query"),
  scope: z.enum(["global", "user", "organization", "project", "repository", "task"]).optional(),
  scopeId: z.string().optional(),
  project: z.string().optional(),
  repository: z.string().optional(),
  types: z.array(z.enum(["semantic", "episode", "procedure", "decision"])).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  limit: z.number().min(1).max(50).optional(),
});

const rememberSchema = z.object({
  subject: z.string(),
  predicate: z.string(),
  value: z.string(),
  confidence: z.number().min(0).max(1).default(0.8),
  sourceType: z.enum(["user", "conversation", "file", "repository", "tool", "agent"]).default("conversation"),
  // Auto-scope: if project or repository is detected from context, use it
  project: z.string().optional(),
  repository: z.string().optional(),
});

const updateMemorySchema = z.object({
  id: z.string(),
  value: z.string().optional(),
  confidence: z.number().min(0).max(1).optional(),
  status: z.enum(["active", "stale", "deprecated", "archived"]).optional(),
});

const forgetSchema = z.object({
  id: z.string(),
});

const recordEpisodeSchema = z.object({
  project: z.string().optional(),
  repository: z.string().optional(),
  task: z.string().optional(),
  trigger: z.string(),
  observations: z.array(z.string()),
  actions: z.array(z.string()),
  outcome: z.string(),
  success: z.boolean(),
  lessons: z.array(z.string()).optional(),
  toolsUsed: z.array(z.string()).optional(),
});

const recordDecisionSchema = z.object({
  project: z.string().optional(),
  repository: z.string().optional(),
  title: z.string(),
  context: z.string(),
  alternatives: z.array(z.string()),
  decision: z.string(),
  rationale: z.string(),
});

const getProcedureSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
});

const updateProcedureSchema = z.object({
  id: z.string(),
  purpose: z.string().optional(),
  steps: z.array(z.object({
    order: z.number(),
    action: z.string(),
    expectedResult: z.string().optional(),
  })).optional(),
  failureModes: z.array(z.object({
    symptom: z.string(),
    diagnosis: z.string(),
    resolution: z.string(),
  })).optional(),
  successCount: z.number().optional(),
  failureCount: z.number().optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const verifyMemorySchema = z.object({
  id: z.string(),
  verifiedValue: z.string(),
});

export const memorySearchTool = {
  name: "memory_search",
  description: "Search across all memory types (semantic, episodes, procedures, decisions). Use this before performing tasks to retrieve relevant context.",
  inputSchema: searchSchema,
  execute: async (input: z.infer<typeof searchSchema>) => {
    const results = await memoryManager.search(input);
    return {
      results: results.map(r => ({
        type: r.type,
        id: r.id,
        score: r.score,
        data: r.data,
      })),
      count: results.length,
    };
  },
};

export const memoryRememberTool = {
  name: "memory_remember",
  description: "Store important information that should be remembered. Use for facts, decisions, project context, and durable knowledge. Auto-scopes to project/repository if provided.",
  inputSchema: rememberSchema,
  execute: async (input: z.infer<typeof rememberSchema>) => {
    // Auto-detect scope based on provided project/repository
    let scope: "global" | "project" | "repository" = "global";
    let scopeId: string | undefined;

    if (input.repository) {
      scope = "repository";
      scopeId = input.repository;
    } else if (input.project) {
      scope = "project";
      scopeId = input.project;
    }

    const memory = await memoryManager.remember({
      scope,
      scopeId,
      subject: input.subject,
      predicate: input.predicate,
      value: input.value,
      confidence: input.confidence,
      source: {
        type: input.sourceType,
      },
    });
    return { success: true, memory, scope, scopeId };
  },
};

export const memoryUpdateTool = {
  name: "memory_update",
  description: "Update an existing memory (change value, confidence, or status).",
  inputSchema: updateMemorySchema,
  execute: async (input: z.infer<typeof updateMemorySchema>) => {
    const memory = await memoryManager.update(input.id, {
      value: input.value,
      confidence: input.confidence,
      status: input.status,
    });
    return { success: true, memory };
  },
};

export const memoryForgetTool = {
  name: "memory_forget",
  description: "Archive a memory so it is no longer active. The memory is not permanently deleted but marked as archived.",
  inputSchema: forgetSchema,
  execute: async (input: z.infer<typeof forgetSchema>) => {
    await memoryManager.forget(input.id);
    return { success: true, message: "Memory archived" };
  },
};

export const memoryRecordEpisodeTool = {
  name: "memory_record_episode",
  description: "Record an experience or task execution. Use after completing meaningful work to capture what happened, what was tried, and the outcome.",
  inputSchema: recordEpisodeSchema,
  execute: async (input: z.infer<typeof recordEpisodeSchema>) => {
    const episode = await memoryManager.recordEpisode(input);
    return { success: true, episode };
  },
};

export const memoryRecordDecisionTool = {
  name: "memory_record_decision",
  description: "Record an architectural or operational decision with context, alternatives, and rationale.",
  inputSchema: recordDecisionSchema,
  execute: async (input: z.infer<typeof recordDecisionSchema>) => {
    const decision = await memoryManager.recordDecision(input);
    return { success: true, decision };
  },
};

export const memoryGetProcedureTool = {
  name: "memory_get_procedure",
  description: "Get a procedure by ID or name.",
  inputSchema: getProcedureSchema,
  execute: async (input: z.infer<typeof getProcedureSchema>) => {
    if (input.id) {
      const procedure = await memoryManager.getProcedure(input.id);
      return { success: true, procedure };
    } else if (input.name) {
      const procedure = await memoryManager.getProcedureByName(input.name);
      return { success: true, procedure };
    }
    return { success: false, error: "Provide either id or name" };
  },
};

export const memoryUpdateProcedureTool = {
  name: "memory_update_procedure",
  description: "Update a procedure (steps, failure modes, success/failure counts).",
  inputSchema: updateProcedureSchema,
  execute: async (input: z.infer<typeof updateProcedureSchema>) => {
    const procedure = await memoryManager.updateProcedure(input.id, {
      purpose: input.purpose,
      steps: input.steps,
      failureModes: input.failureModes,
      successCount: input.successCount,
      failureCount: input.failureCount,
      confidence: input.confidence,
    });
    return { success: true, procedure };
  },
};

export const memoryVerifyTool = {
  name: "memory_verify",
  description: "Verify a memory against current reality. Updates confidence based on whether the stored value matches the verified value.",
  inputSchema: verifyMemorySchema,
  execute: async (input: z.infer<typeof verifyMemorySchema>) => {
    const memory = await memoryManager.verifyMemory(input.id, input.verifiedValue);
    return { success: true, memory };
  },
};

export const memoryGetTool = {
  name: "memory_get",
  description: "Get a specific memory by ID.",
  inputSchema: z.object({ id: z.string() }),
  execute: async (input: { id: string }) => {
    const memory = await memoryManager.getMemory(input.id);
    return { success: true, memory };
  },
};

export const memoryListTool = {
  name: "memory_list",
  description: "List all memories for a given scope.",
  inputSchema: z.object({
    scope: z.enum(["global", "user", "organization", "project", "repository", "task"]).optional(),
    scopeId: z.string().optional(),
  }),
  execute: async (input: { scope?: string; scopeId?: string }) => {
    const memories = await memoryManager.listMemories(
      input.scope as any,
      input.scopeId
    );
    return { success: true, memories, count: memories.length };
  },
};

export const memoryRetrieveContextTool = {
  name: "memory_retrieve_context",
  description: "Retrieve relevant memories before starting a task. Call this at the beginning of meaningful work to get relevant context, procedures, decisions, and previous experiences.",
  inputSchema: z.object({
    task: z.string().describe("The task or goal being pursued"),
    project: z.string().optional(),
    repository: z.string().optional(),
    files: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
  }),
  execute: async (input: { task: string; project?: string; repository?: string; files?: string[]; tools?: string[] }) => {
    const { retrieveRelevantMemories } = await import("../hooks");
    await retrieveRelevantMemories(input);
    return { success: true, message: "Memory retrieval completed" };
  },
};

export const memoryExtractFactsTool = {
  name: "memory_extract_facts",
  description: "Extract and store important facts from conversation or text. Use after discovering important information.",
  inputSchema: z.object({
    text: z.string().describe("Text containing facts to extract"),
    scope: z.enum(["global", "project", "repository"]),
    scopeId: z.string().optional(),
    sourceType: z.enum(["conversation", "file", "tool"]).optional(),
  }),
  execute: async (input: { text: string; scope: "global" | "project" | "repository"; scopeId?: string; sourceType?: "conversation" | "file" | "tool" }) => {
    const { extractFactsFromText } = await import("../hooks");
    await extractFactsFromText(input.text, input.scope, input.scopeId, input.sourceType);
    return { success: true, message: "Facts extracted" };
  },
};

export const memoryConsolidateTool = {
  name: "memory_consolidate",
  description: "Consolidate repeated episodes into reusable procedures. Call this periodically to learn from past experiences.",
  inputSchema: z.object({
    project: z.string().optional(),
    repository: z.string().optional(),
    minEpisodes: z.number().min(2).default(3),
  }),
  execute: async (input: { project?: string; repository?: string; minEpisodes?: number }) => {
    const { consolidateEpisodes } = await import("../consolidation");
    const result = await consolidateEpisodes(input);
    return { success: true, ...result };
  },
};

export const memoryFindStaleTool = {
  name: "memory_find_stale",
  description: "Find memories that have not been verified recently and may be outdated.",
  inputSchema: z.object({
    daysThreshold: z.number().min(7).default(30),
  }),
  execute: async (input: { daysThreshold?: number }) => {
    const { findStaleMemories } = await import("../consolidation");
    const staleIds = await findStaleMemories(input.daysThreshold || 30);
    return { success: true, staleIds, count: staleIds.length };
  },
};

export const memoryArchiveStaleTool = {
  name: "memory_archive_stale",
  description: "Archive memories that have not been used for a long time.",
  inputSchema: z.object({
    daysThreshold: z.number().min(30).default(90),
  }),
  execute: async (input: { daysThreshold?: number }) => {
    const { archiveStaleMemories } = await import("../consolidation");
    const archived = await archiveStaleMemories(input.daysThreshold || 90);
    return { success: true, archived };
  },
};
