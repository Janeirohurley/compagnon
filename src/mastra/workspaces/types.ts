// Workspace domain types (TASK-001).
//
// A workspace is Compagnon's tenancy unit. It is an application-level alias
// over Mastra's `resourceId`: all memory (working, recall, threads),
// conversations and connections are keyed by the workspace's id. Per-workspace
// runtime (enabled agents, MCP/tools, project root) and config (model,
// instructions) are applied in Phase 2/3.
export interface WorkspaceModelConfig {
  providerId?: string;
  modelId?: string;
  url?: string;
  apiKey?: string;
}

export interface WorkspaceConfig {
  /** Absolute root the project-file tools operate on for this workspace. */
  projectPath: string;
  /** Sub-agents enabled for this workspace (Phase 2: runtime filtering). */
  enabledAgents: string[];
  /** Optional per-workspace model override (falls back to env in Phase 3). */
  model?: WorkspaceModelConfig;
  /** Optional marker appended above the base companion instructions (Phase 3). */
  instructions?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  config: WorkspaceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceStore {
  get(id: string): Promise<Workspace | null>;
  list(): Promise<Workspace[]>;
  create(input: { id: string; name: string; slug: string; config: WorkspaceConfig }): Promise<Workspace>;
}

export const DEFAULT_WORKSPACE_ID = "default";

/** Sub-agents available in the codebase (used as the bootstrap default set). */
export const ALL_ENABLED_AGENTS = [
  "memory",
  "planner",
  "github",
  "outline",
  "notion",
  "plane",
  "research",
] as const;