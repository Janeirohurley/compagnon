import type { ResearchRequest, ResearchResult } from "./types";

/**
 * Input contract for delegating a research task to the Research Agent,
 * following the same shape as the other specialist agents (Planner, GitHub,
 * Outline).
 */
export interface ResearchTaskInput {
  question: string;
  objective?: string;
  scope?: string;
  constraints?: string[];
  freshnessRequirement?: ResearchRequest["freshnessRequirement"];
  preferredSources?: string[];
  excludedSources?: string[];
  expectedOutput?: string;
  depth?: ResearchRequest["depth"];
}

/**
 * Input contract for the research runtime. `request` mirrors ResearchTaskInput
 * plus an optional `question`, while `options` lets the caller tune limits and
 * depth without touching the request contract.
 */
export interface ResearchRuntimeInput {
  request: ResearchTaskInput | ResearchRequest;
  options?: {
    depth?: ResearchRequest["depth"];
    maxIterations?: number;
    maxSearches?: number;
    maxReads?: number;
    maxRuntimeMs?: number;
  };
}

/**
 * Output contract from the Research Agent: a structured, evidence-backed
 * report that Compagnon can present or pass along (e.g. to the Planner Agent).
 */
export interface ResearchTaskResult {
  status: ResearchResult["status"];
  report?: ResearchResult;
  summary?: string;
  error?: string;
  errors?: string[];
}

/** Shape of the research agent as consumed by the runtime (injectable for tests). */
export interface ResearchAgentLike {
  generate: (
    prompt: string,
    options?: {
      structuredOutput?: {
        schema: unknown;
        jsonPromptInjection?: "auto" | "system" | "inline" | boolean;
      };
    },
  ) => Promise<{ text?: string; object?: unknown }>;
}