import type { PlaneOperation, PlaneStatus, Priority, WorkItemState } from "./enums";

/**
 * Work item summary.
 */
export interface WorkItemSummary {
  id: string;
  identifier: string;
  name: string;
  state: WorkItemState;
  priority: Priority;
  assignees: string[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  cycleId?: string;
  moduleId?: string;
}

/**
 * Cycle summary.
 */
export interface CycleSummary {
  id: string;
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  progress: number; // 0-100
}

/**
 * Module summary.
 */
export interface ModuleSummary {
  id: string;
  name: string;
  description?: string;
  progress: number; // 0-100
  workItemsCount: number;
  completedCount: number;
}

/**
 * Project summary.
 */
export interface ProjectSummary {
  id: string;
  identifier: string;
  name: string;
  description?: string;
  workItemsCount: number;
  membersCount: number;
  createdAt: string;
}

/**
 * Blockage report.
 */
export interface BlockageReport {
  workItem: WorkItemSummary;
  reason: string;
  blockedSince: string;
  dependencies?: string[];
  suggestedAction: string;
  priority: Priority;
}

/**
 * Advancement report for a project.
 */
export interface AdvancementReport {
  project: string;
  projectIdentifier: string;
  generatedAt: string;
  totalWorkItems: number;
  completed: number;
  inProgress: number;
  todo: number;
  backlog: number;
  cancelled: number;
  blocked: number;
  completionRate: number;
  activeCycle: CycleSummary | null;
  upcomingCycles: CycleSummary[];
  modules: ModuleSummary[];
  blockages: BlockageReport[];
  recentCompletions: WorkItemSummary[];
  recentUpdates: WorkItemSummary[];
  recommendations: string[];
}

/**
 * Input for the Plane Agent.
 */
export interface PlaneAgentInput {
  operation: PlaneOperation;
  project?: string; // project identifier or name
  projectId?: string; // project UUID
  parameters?: Record<string, unknown>;
  context?: string;
}

/**
 * Result of a Plane Agent operation.
 */
export interface PlaneAgentResult {
  status: PlaneStatus;
  operation: PlaneOperation;
  result?: unknown;
  summary: string;
  report?: AdvancementReport;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  memoryRecommendations?: string[];
}
