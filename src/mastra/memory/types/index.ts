// Memory types based on the Compagnon Memory Engineering specification

export type MemoryScope = "global" | "user" | "organization" | "project" | "repository" | "task";

export type MemoryStatus = "active" | "stale" | "deprecated" | "superseded" | "archived";

export type SourceType = "user" | "conversation" | "file" | "repository" | "tool" | "agent";

export interface MemorySource {
  type: SourceType;
  reference?: string;
}

export interface SemanticMemory {
  id: string;
  scope: MemoryScope;
  scopeId?: string;
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  source: MemorySource;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt?: Date;
  lastVerifiedAt?: Date;
  status: MemoryStatus;
  embedding?: number[];
  useCount: number;
}

export interface Episode {
  id: string;
  project?: string;
  repository?: string;
  task?: string;
  trigger: string;
  observations: string[];
  actions: string[];
  outcome: string;
  success: boolean;
  lessons?: string[];
  toolsUsed?: string[];
  createdAt: Date;
  embedding?: number[];
}

export interface ProcedureStep {
  order: number;
  action: string;
  expectedResult?: string;
}

export interface ProcedureFailureMode {
  symptom: string;
  diagnosis: string;
  resolution: string;
}

export interface Procedure {
  id: string;
  name: string;
  purpose: string;
  prerequisites: string[];
  steps: ProcedureStep[];
  failureModes?: ProcedureFailureMode[];
  successCount: number;
  failureCount: number;
  confidence: number;
  source: string[];
  createdAt: Date;
  updatedAt: Date;
  embedding?: number[];
}

export interface Decision {
  id: string;
  project?: string;
  repository?: string;
  title: string;
  context: string;
  alternatives: string[];
  decision: string;
  rationale: string;
  status: "pending" | "accepted" | "rejected" | "superseded";
  supersededBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryConflict {
  id: string;
  memoryAId: string;
  memoryBId: string;
  memoryAExcerpt: string;
  memoryBExcerpt: string;
  reason: string;
  detectedAt: Date;
  resolution: "pending" | "resolved_a" | "resolved_b" | "dismissed";
  resolvedAt?: Date;
}

export interface MemorySearchInput {
  query: string;
  scope?: MemoryScope;
  scopeId?: string;
  project?: string;
  repository?: string;
  types?: Array<"semantic" | "episode" | "procedure" | "decision">;
  minConfidence?: number;
  limit?: number;
}

export interface MemorySearchResult {
  type: "semantic" | "episode" | "procedure" | "decision";
  id: string;
  score: number;
  data: SemanticMemory | Episode | Procedure | Decision;
}

export interface RememberInput {
  scope: MemoryScope;
  scopeId?: string;
  subject: string;
  predicate: string;
  value: string;
  confidence: number;
  source: MemorySource;
  project?: string;
  repository?: string;
}

export interface UpdateMemoryInput {
  value?: string;
  confidence?: number;
  status?: MemoryStatus;
  lastVerifiedAt?: Date;
}

export interface EpisodeInput {
  project?: string;
  repository?: string;
  task?: string;
  trigger: string;
  observations: string[];
  actions: string[];
  outcome: string;
  success: boolean;
  lessons?: string[];
  toolsUsed?: string[];
}

export interface DecisionInput {
  project?: string;
  repository?: string;
  title: string;
  context: string;
  alternatives: string[];
  decision: string;
  rationale: string;
}

export interface ProcedureInput {
  name: string;
  purpose: string;
  prerequisites: string[];
  steps: ProcedureStep[];
  failureModes?: ProcedureFailureMode[];
}

export interface UpdateProcedureInput {
  purpose?: string;
  steps?: ProcedureStep[];
  failureModes?: ProcedureFailureMode[];
  successCount?: number;
  failureCount?: number;
  confidence?: number;
}

export interface IMemoryManager {
  search(input: MemorySearchInput): Promise<MemorySearchResult[]>;
  remember(input: RememberInput): Promise<SemanticMemory>;
  update(id: string, input: UpdateMemoryInput): Promise<SemanticMemory>;
  forget(id: string): Promise<void>;
  recordEpisode(input: EpisodeInput): Promise<Episode>;
  recordDecision(input: DecisionInput): Promise<Decision>;
  getProcedure(id: string): Promise<Procedure | null>;
  updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure>;
  createProcedure(input: ProcedureInput): Promise<Procedure>;
  detectConflicts(candidate: RememberInput): Promise<MemoryConflict[]>;
  getMemory(id: string): Promise<SemanticMemory | null>;
  listMemories(scope?: MemoryScope, scopeId?: string): Promise<SemanticMemory[]>;
  listEpisodes(project?: string, repository?: string): Promise<Episode[]>;
  listDecisions(project?: string, repository?: string): Promise<Decision[]>;
  verifyMemory(id: string, verifiedValue: string): Promise<SemanticMemory>;
  supersedeMemory(id: string, newMemory: RememberInput): Promise<SemanticMemory>;
}
