// Memory contracts - interfaces for the memory system
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
} from "./types";

export interface IMemoryManager {
  // Search & Retrieval
  search(input: MemorySearchInput): Promise<MemorySearchResult[]>;
  getMemory(id: string): Promise<SemanticMemory | null>;
  listMemories(scope?: MemoryScope, scopeId?: string): Promise<SemanticMemory[]>;

  // Memory operations
  remember(input: RememberInput): Promise<SemanticMemory>;
  update(id: string, input: UpdateMemoryInput): Promise<SemanticMemory>;
  forget(id: string): Promise<void>;
  deleteMemory(id: string): Promise<void>;

  // Episodes
  recordEpisode(input: EpisodeInput): Promise<Episode>;
  listEpisodes(project?: string, repository?: string): Promise<Episode[]>;
  getEpisode(id: string): Promise<Episode | null>;
  deleteEpisode(id: string): Promise<void>;

  // Decisions
  recordDecision(input: DecisionInput): Promise<Decision>;
  listDecisions(project?: string, repository?: string): Promise<Decision[]>;
  getDecision(id: string): Promise<Decision | null>;
  updateDecision(id: string, updates: Partial<Decision>): Promise<Decision | null>;
  deleteDecision(id: string): Promise<void>;

  // Procedures
  getProcedure(id: string): Promise<Procedure | null>;
  getProcedureByName(name: string): Promise<Procedure | null>;
  createProcedure(input: ProcedureInput): Promise<Procedure>;
  updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure>;
  listAllProcedures(): Promise<Procedure[]>;
  deleteProcedure(id: string): Promise<void>;

  // Conflicts
  detectConflicts(candidate: RememberInput): Promise<MemoryConflict[]>;
  getPendingConflicts(): Promise<MemoryConflict[]>;
  resolveConflict(id: string, resolution: MemoryConflict["resolution"]): Promise<MemoryConflict | null>;

  // Verification
  verifyMemory(id: string, verifiedValue: string): Promise<SemanticMemory>;

  // Advanced
  supersedeMemory(id: string, newMemory: RememberInput): Promise<SemanticMemory>;
  consolidateEpisodes(input: { project?: string; repository?: string; minEpisodes?: number }): Promise<{
    proceduresCreated: number;
    episodesConsolidated: number;
    details: string[];
  }>;
  findStaleMemories(daysThreshold?: number): Promise<string[]>;
  archiveStaleMemories(daysThreshold?: number): Promise<number>;
}

export interface MemoryServiceConfig {
  scope: MemoryScope;
  scopeId?: string;
  autoConsolidate?: boolean;
  consolidationIntervalMs?: number;
  staleThresholdDays?: number;
  archiveThresholdDays?: number;
}
