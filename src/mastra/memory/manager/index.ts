// Memory Manager - central service for all memory operations
import { SQL_SCHEMA } from "../db/schema";
import { memoryDb, initializeMemoryDatabase } from "../db/client";
import { logMemoryEvent } from "../observability";
import type {
  SemanticMemory,
  Episode,
  Procedure,
  Decision,
  MemoryConflict,
  MemorySearchInput,
  MemorySearchResult,
  RememberInput,
  UpdateMemoryInput,
  EpisodeInput,
  DecisionInput,
  ProcedureInput,
  UpdateProcedureInput,
  MemoryScope,
  MemoryStatus,
} from "../types";

function generateId(): string {
  return crypto.randomUUID();
}

// Memory Manager implementation with Turso/SQLite persistence
export class MemoryManager {
  private initialized: boolean = false;

  constructor() {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await initializeMemoryDatabase();
    console.log("[Memory] Initialized with Turso/SQLite");
    this.initialized = true;
  }

  // Search across all memory types
  async search(input: MemorySearchInput): Promise<MemorySearchResult[]> {
    await this.initialize();
    const results: MemorySearchResult[] = [];
    const { query, scope, scopeId, project, repository, types, minConfidence = 0, limit = 10 } = input;

    const queryLower = query.toLowerCase();

    logMemoryEvent({
      type: "memory.retrieved",
      scope,
      scopeId,
      details: { query, types, limit },
    });

    if (!types || types.includes("semantic")) {
      const memories = await this.listMemories(scope, scopeId);
      
      for (const memory of memories) {
        if (memory.status !== "active") continue;
        if (memory.confidence < minConfidence) continue;
        
        const text = `${memory.subject} ${memory.predicate} ${memory.value}`.toLowerCase();
        if (text.includes(queryLower) || queryLower.includes(memory.subject.toLowerCase())) {
          const score = this.calculateRelevanceScore(memory, project, repository);
          results.push({ type: "semantic", id: memory.id, score, data: memory });
        }
      }
    }

    if (!types || types.includes("episode")) {
      const episodes = await this.listEpisodes(project, repository);
      
      for (const episode of episodes) {
        const text = `${episode.trigger} ${episode.outcome} ${episode.observations.join(" ")}`.toLowerCase();
        if (text.includes(queryLower)) {
          results.push({ type: "episode", id: episode.id, score: 0.5, data: episode });
        }
      }
    }

    if (!types || types.includes("decision")) {
      const decisions = await this.listDecisions(project, repository);
      
      for (const decision of decisions) {
        const text = `${decision.title} ${decision.context} ${decision.rationale}`.toLowerCase();
        if (text.includes(queryLower)) {
          results.push({ type: "decision", id: decision.id, score: 0.5, data: decision });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  private calculateRelevanceScore(
    memory: SemanticMemory,
    project?: string,
    repository?: string
  ): number {
    let score = memory.confidence;
    
    if (project && memory.scopeId === project) score += 0.1;
    if (repository && memory.scopeId === repository) score += 0.15;
    
    if (memory.lastUsedAt) {
      const daysSinceUse = (Date.now() - new Date(memory.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 0.1 - daysSinceUse / 100);
    }
    
    score += Math.min(0.1, memory.useCount / 100);
    
    return Math.min(1, score);
  }

  // Create a new semantic memory
  async remember(input: RememberInput): Promise<SemanticMemory> {
    await this.initialize();
    const { scope, scopeId, subject, predicate, value, confidence, source } = input;

    const nowDate = new Date();
    const id = generateId();

    await memoryDb.execute({
      sql: `INSERT INTO semantic_memories
        (id, scope, scope_id, subject, predicate, value, confidence, source_type, source_reference, created_at, updated_at, status, use_count)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, scope, scopeId || null, subject, predicate, value, confidence,
        source.type, source.reference || null, nowDate.toISOString(), nowDate.toISOString(), "active", 0
      ],
    });

    logMemoryEvent({
      type: "memory.created",
      memoryId: id,
      memoryType: "semantic",
      scope,
      scopeId,
      details: { subject, predicate, value, confidence },
    });

    const memory: SemanticMemory = {
      id,
      scope,
      scopeId,
      subject,
      predicate,
      value,
      confidence,
      source,
      createdAt: nowDate,
      updatedAt: nowDate,
      status: "active",
      useCount: 0,
    };

    console.log(`[Memory] Created: ${subject} ${predicate} ${value} (confidence: ${confidence})`);
    
    return memory;
  }

  // Update an existing memory
  async update(id: string, input: UpdateMemoryInput): Promise<SemanticMemory> {
    await this.initialize();
    const existing = await this.getMemory(id);
    if (!existing) throw new Error(`Memory not found: ${id}`);

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (input.value !== undefined) {
      updates.push("value = ?");
      args.push(input.value);
    }
    if (input.confidence !== undefined) {
      updates.push("confidence = ?");
      args.push(input.confidence);
    }
    if (input.status !== undefined) {
      updates.push("status = ?");
      args.push(input.status);
    }
    if (input.lastVerifiedAt !== undefined) {
      updates.push("last_verified_at = ?");
      args.push(input.lastVerifiedAt.toISOString());
    }

    updates.push("updated_at = ?");
    args.push(new Date().toISOString());
    args.push(id);

    await memoryDb.execute({
      sql: `UPDATE semantic_memories SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    return (await this.getMemory(id))!;
  }

  // Delete/archive a memory
  async forget(id: string): Promise<void> {
    await this.initialize();
    await memoryDb.execute({
      sql: `UPDATE semantic_memories SET status = 'archived', updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), id],
    });
  }

  // Record an episode
  async recordEpisode(input: EpisodeInput): Promise<Episode> {
    await this.initialize();
    const id = generateId();
    const nowDate = new Date();

    await memoryDb.execute({
      sql: `INSERT INTO episodes 
        (id, project, repository, task, trigger, observations, actions, outcome, success, lessons, tools_used, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, input.project || null, input.repository || null, input.task || null,
        input.trigger, JSON.stringify(input.observations), JSON.stringify(input.actions),
        input.outcome, input.success ? 1 : 0, 
        input.lessons ? JSON.stringify(input.lessons) : null,
        input.toolsUsed ? JSON.stringify(input.toolsUsed) : null,
        nowDate.toISOString()
      ],
    });

    const episode: Episode = {
      id,
      ...input,
      createdAt: nowDate,
    };

    console.log(`[Memory] Recorded episode: ${input.trigger.substring(0, 50)}`);
    
    return episode;
  }

  // Record a decision
  async recordDecision(input: DecisionInput): Promise<Decision> {
    await this.initialize();
    const id = generateId();
    const nowDate = new Date();

    await memoryDb.execute({
      sql: `INSERT INTO decisions 
        (id, project, repository, title, context, alternatives, decision, rationale, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, input.project || null, input.repository || null, input.title,
        input.context, JSON.stringify(input.alternatives), input.decision, input.rationale,
        "accepted", nowDate.toISOString(), nowDate.toISOString()
      ],
    });

    const decision: Decision = {
      id,
      ...input,
      status: "accepted",
      createdAt: nowDate,
      updatedAt: nowDate,
    };

    console.log(`[Memory] Recorded decision: ${input.title}`);
    
    return decision;
  }

  // Get procedure by ID
  async getProcedure(id: string): Promise<Procedure | null> {
    await this.initialize();
    const result = await memoryDb.execute({
      sql: "SELECT * FROM procedures WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return this.rowToProcedure(result.rows[0]);
  }

  // Get procedure by name
  async getProcedureByName(name: string): Promise<Procedure | null> {
    await this.initialize();
    const result = await memoryDb.execute({
      sql: "SELECT * FROM procedures WHERE name = ?",
      args: [name],
    });

    if (result.rows.length === 0) return null;
    return this.rowToProcedure(result.rows[0]);
  }

  private rowToProcedure(row: Record<string, unknown>): Procedure {
    return {
      id: row.id as string,
      name: row.name as string,
      purpose: row.purpose as string,
      prerequisites: JSON.parse(row.prerequisites as string),
      steps: JSON.parse(row.steps as string),
      failureModes: row.failure_modes ? JSON.parse(row.failure_modes as string) : undefined,
      successCount: row.success_count as number,
      failureCount: row.failure_count as number,
      confidence: row.confidence as number,
      source: JSON.parse(row.source as string),
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // Create procedure
  async createProcedure(input: ProcedureInput): Promise<Procedure> {
    await this.initialize();
    const id = generateId();
    const nowDate = new Date();

    await memoryDb.execute({
      sql: `INSERT INTO procedures 
        (id, name, purpose, prerequisites, steps, failure_modes, success_count, failure_count, confidence, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id, input.name, input.purpose, JSON.stringify(input.prerequisites),
        JSON.stringify(input.steps), input.failureModes ? JSON.stringify(input.failureModes) : null,
        0, 0, 0.5, "[]",
        nowDate.toISOString(), nowDate.toISOString()
      ],
    });

    return {
      id,
      ...input,
      successCount: 0,
      failureCount: 0,
      confidence: 0.5,
      source: [],
      createdAt: nowDate,
      updatedAt: nowDate,
    };
  }

  // Update procedure
  async updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure> {
    await this.initialize();
    const existing = await this.getProcedure(id);
    if (!existing) throw new Error(`Procedure not found: ${id}`);

    const updates: string[] = [];
    const args: (string | number | null)[] = [];

    if (input.purpose !== undefined) {
      updates.push("purpose = ?");
      args.push(input.purpose);
    }
    if (input.steps !== undefined) {
      updates.push("steps = ?");
      args.push(JSON.stringify(input.steps));
    }
    if (input.failureModes !== undefined) {
      updates.push("failure_modes = ?");
      args.push(JSON.stringify(input.failureModes));
    }
    if (input.successCount !== undefined) {
      updates.push("success_count = ?");
      args.push(input.successCount);
    }
    if (input.failureCount !== undefined) {
      updates.push("failure_count = ?");
      args.push(input.failureCount);
    }
    if (input.confidence !== undefined) {
      updates.push("confidence = ?");
      args.push(input.confidence);
    }

    updates.push("updated_at = ?");
    args.push(new Date().toISOString());
    args.push(id);

    await memoryDb.execute({
      sql: `UPDATE procedures SET ${updates.join(", ")} WHERE id = ?`,
      args,
    });

    return (await this.getProcedure(id))!;
  }

  // Detect conflicts with existing memories
  async detectConflicts(candidate: RememberInput): Promise<MemoryConflict[]> {
    await this.initialize();
    const conflicts: MemoryConflict[] = [];
    const memories = await this.listMemories(candidate.scope, candidate.scopeId);

    for (const memory of memories) {
      if (memory.status !== "active") continue;
      if (memory.subject.toLowerCase() !== candidate.subject.toLowerCase()) continue;

      if (memory.predicate.toLowerCase() === candidate.predicate.toLowerCase() &&
          memory.value.toLowerCase() !== candidate.value.toLowerCase()) {
        const conflict: MemoryConflict = {
          id: generateId(),
          memoryAId: memory.id,
          memoryBId: "",
          memoryAExcerpt: `${memory.subject} ${memory.predicate} ${memory.value}`,
          memoryBExcerpt: `${candidate.subject} ${candidate.predicate} ${candidate.value}`,
          reason: `Conflicting values for "${candidate.subject} ${candidate.predicate}"`,
          detectedAt: new Date(),
          resolution: "pending",
        };

        // Persist conflict to database
        await memoryDb.execute({
          sql: `INSERT INTO memory_conflicts
            (id, memory_a_id, memory_b_id, memory_a_excerpt, memory_b_excerpt, reason, detected_at, resolution)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            conflict.id, conflict.memoryAId, conflict.memoryBId,
            conflict.memoryAExcerpt, conflict.memoryBExcerpt,
            conflict.reason, conflict.detectedAt.toISOString(), "pending"
          ],
        });

        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  // Get memory by ID
  async getMemory(id: string): Promise<SemanticMemory | null> {
    await this.initialize();
    const result = await memoryDb.execute({
      sql: "SELECT * FROM semantic_memories WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) return null;
    return this.rowToMemory(result.rows[0]);
  }

  private rowToMemory(row: Record<string, unknown>): SemanticMemory {
    return {
      id: row.id as string,
      scope: row.scope as MemoryScope,
      scopeId: row.scope_id as string | undefined,
      subject: row.subject as string,
      predicate: row.predicate as string,
      value: row.value as string,
      confidence: row.confidence as number,
      source: {
        type: row.source_type as "user" | "conversation" | "file" | "repository" | "tool" | "agent",
        reference: row.source_reference as string | undefined,
      },
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : undefined,
      lastVerifiedAt: row.last_verified_at ? new Date(row.last_verified_at as string) : undefined,
      status: row.status as MemoryStatus,
      useCount: row.use_count as number,
    };
  }

  // List memories
  async listMemories(scope?: MemoryScope, scopeId?: string): Promise<SemanticMemory[]> {
    await this.initialize();
    let sql = "SELECT * FROM semantic_memories WHERE status = 'active'";
    const args: (string | null)[] = [];

    if (scope) {
      sql += " AND scope = ?";
      args.push(scope);
      if (scopeId) {
        sql += " AND scope_id = ?";
        args.push(scopeId);
      }
    }

    sql += " ORDER BY updated_at DESC";

    const result = await memoryDb.execute({ sql, args });
    return result.rows.map(row => this.rowToMemory(row));
  }

  // List episodes
  async listEpisodes(project?: string, repository?: string): Promise<Episode[]> {
    await this.initialize();
    let sql = "SELECT * FROM episodes";
    const args: (string | null)[] = [];

    if (project || repository) {
      sql += " WHERE";
      if (project) {
        sql += " project = ?";
        args.push(project);
      }
      if (project && repository) sql += " AND";
      if (repository) {
        sql += " repository = ?";
        args.push(repository);
      }
    }

    sql += " ORDER BY created_at DESC";

    const result = await memoryDb.execute({ sql, args });
    return result.rows.map(row => this.rowToEpisode(row));
  }

  private rowToEpisode(row: Record<string, unknown>): Episode {
    return {
      id: row.id as string,
      project: row.project as string | undefined,
      repository: row.repository as string | undefined,
      task: row.task as string | undefined,
      trigger: row.trigger as string,
      observations: JSON.parse(row.observations as string),
      actions: JSON.parse(row.actions as string),
      outcome: row.outcome as string,
      success: Boolean(row.success),
      lessons: row.lessons ? JSON.parse(row.lessons as string) : undefined,
      toolsUsed: row.tools_used ? JSON.parse(row.tools_used as string) : undefined,
      createdAt: new Date(row.created_at as string),
    };
  }

  // List decisions
  async listDecisions(project?: string, repository?: string): Promise<Decision[]> {
    await this.initialize();
    let sql = "SELECT * FROM decisions";
    const args: (string | null)[] = [];

    if (project || repository) {
      sql += " WHERE";
      if (project) {
        sql += " project = ?";
        args.push(project);
      }
      if (project && repository) sql += " AND";
      if (repository) {
        sql += " repository = ?";
        args.push(repository);
      }
    }

    sql += " ORDER BY created_at DESC";

    const result = await memoryDb.execute({ sql, args });
    return result.rows.map(row => this.rowToDecision(row));
  }

  private rowToDecision(row: Record<string, unknown>): Decision {
    return {
      id: row.id as string,
      project: row.project as string | undefined,
      repository: row.repository as string | undefined,
      title: row.title as string,
      context: row.context as string,
      alternatives: JSON.parse(row.alternatives as string),
      decision: row.decision as string,
      rationale: row.rationale as string,
      status: row.status as "pending" | "accepted" | "rejected" | "superseded",
      supersededBy: row.superseded_by as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
    };
  }

  // Verify memory against current state
  async verifyMemory(id: string, verifiedValue: string): Promise<SemanticMemory> {
    await this.initialize();
    const memory = await this.getMemory(id);
    if (!memory) throw new Error(`Memory not found: ${id}`);

    const matches = memory.value.toLowerCase() === verifiedValue.toLowerCase();
    const newConfidence = matches 
      ? Math.min(1, memory.confidence + 0.1) 
      : Math.max(0.4, memory.confidence - 0.2);

    const newStatus = matches ? "active" : "stale";

    await memoryDb.execute({
      sql: `UPDATE semantic_memories SET confidence = ?, status = ?, last_verified_at = ?, updated_at = ? WHERE id = ?`,
      args: [newConfidence, newStatus, new Date().toISOString(), new Date().toISOString(), id],
    });

    return (await this.getMemory(id))!;
  }

  // Supersede old memory with new one
  async supersedeMemory(id: string, newMemory: RememberInput): Promise<SemanticMemory> {
    await this.initialize();
    const oldMemory = await this.getMemory(id);
    if (!oldMemory) throw new Error(`Memory not found: ${id}`);

    await memoryDb.execute({
      sql: `UPDATE semantic_memories SET status = 'superseded', updated_at = ? WHERE id = ?`,
      args: [new Date().toISOString(), id],
    });

    return this.remember({
      ...newMemory,
      source: { ...newMemory.source, reference: `superseded:${id}` },
    });
  }

  // Get pending conflicts
  async getPendingConflicts(): Promise<MemoryConflict[]> {
    await this.initialize();
    const result = await memoryDb.execute({
      sql: "SELECT * FROM memory_conflicts WHERE resolution = 'pending' ORDER BY detected_at DESC",
      args: [],
    });

    return result.rows.map(row => ({
      id: row.id as string,
      memoryAId: row.memory_a_id as string,
      memoryBId: row.memory_b_id as string,
      memoryAExcerpt: row.memory_a_excerpt as string,
      memoryBExcerpt: row.memory_b_excerpt as string,
      reason: row.reason as string,
      detectedAt: new Date(row.detected_at as string),
      resolution: row.resolution as "pending" | "resolved_a" | "resolved_b" | "dismissed",
      resolvedAt: row.resolved_at ? new Date(row.resolved_at as string) : undefined,
    }));
  }

  // Resolve a conflict
  async resolveConflict(
    conflictId: string,
    resolution: "resolved_a" | "resolved_b" | "dismissed"
  ): Promise<void> {
    await this.initialize();
    await memoryDb.execute({
      sql: `UPDATE memory_conflicts SET resolution = ?, resolved_at = ? WHERE id = ?`,
      args: [resolution, new Date().toISOString(), conflictId],
    });
  }
}

// Singleton instance
export const memoryManager = new MemoryManager();
