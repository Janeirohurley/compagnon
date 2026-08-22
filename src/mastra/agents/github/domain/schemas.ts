import { z } from "zod";
import {
  GitHubOperation,
  GitHubStatus,
  IssueState,
  PRState,
} from "./enums";

// --- Enums as Zod ---

export const githubOperationSchema = z.enum([
  GitHubOperation.CREATE_ISSUE,
  GitHubOperation.UPDATE_ISSUE,
  GitHubOperation.LIST_ISSUES,
  GitHubOperation.GET_ISSUE,
  GitHubOperation.COMMENT_ISSUE,
  GitHubOperation.LIST_PRS,
  GitHubOperation.GET_PR,
  GitHubOperation.CREATE_PR,
  GitHubOperation.MERGE_PR,
  GitHubOperation.SEARCH_CODE,
  GitHubOperation.GET_FILE,
  GitHubOperation.LIST_BRANCHES,
  GitHubOperation.LIST_COMMITS,
  GitHubOperation.REPO_ANALYSIS,
]);

export const issueStateSchema = z.enum([
  IssueState.OPEN,
  IssueState.CLOSED,
  IssueState.ALL,
]);

export const prStateSchema = z.enum([
  PRState.OPEN,
  PRState.CLOSED,
  PRState.MERGED,
  PRState.ALL,
]);

export const githubStatusSchema = z.enum([
  GitHubStatus.SUCCESS,
  GitHubStatus.PARTIAL,
  GitHubStatus.FAILED,
  GitHubStatus.BLOCKED,
  GitHubStatus.NEEDS_CLARIFICATION,
]);

// --- Parameters ---

export const githubParametersSchema = z.object({
  issueNumber: z.number().int().positive().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  state: z.union([issueStateSchema, prStateSchema]).optional(),
  labels: z.array(z.string()).optional(),
  assignees: z.array(z.string()).optional(),
  prNumber: z.number().int().positive().optional(),
  branch: z.string().optional(),
  baseBranch: z.string().optional(),
  filePath: z.string().optional(),
  query: z.string().optional(),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(100).optional(),
  sort: z.string().optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

// --- Input / Output ---

export const githubAgentInputSchema = z.object({
  operation: githubOperationSchema,
  repository: z.string().optional(),
  parameters: githubParametersSchema,
  context: z.string().optional(),
  memoryContext: z.unknown().optional(),
});

export const githubAgentResultSchema = z.object({
  status: githubStatusSchema,
  operation: githubOperationSchema,
  result: z.unknown().optional(),
  summary: z.string(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
  memoryRecommendations: z.array(z.string()).optional(),
});

// --- Task contracts (delegation) ---

export const githubTaskInputSchema = z.object({
  operation: githubOperationSchema,
  repository: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()),
  context: z.string().optional(),
});

export const githubTaskResultSchema = z.object({
  status: githubStatusSchema,
  operation: githubOperationSchema,
  result: z.unknown().optional(),
  summary: z.string(),
  errors: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});
