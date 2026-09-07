// Research Request Tool - lets Compagnon obtain a structured, evidence-backed
// research report from the Research Agent.
import { z } from "zod";
import { researchAgent } from "../agents/research/agent";
import { runResearch, formatResearchSummary } from "../agents/research";

export const researchRequestTool = {
  id: "research_request",
  name: "research_request",
  description:
    "Obtain a validated, evidence-backed research report from the Research subagent. Use for research/comparison questions (tools, libraries, pricing, versions, best practices, ecosystem state), verification of facts, or any request needing sourced information. Returns the structured report (answer, executiveSummary, findings, sources, evidence, contradictions, uncertainties, recommendations, limits) together with a status: success / partial / blocked / failed. Pass the full research question; the Research Agent plans, searches, reads, cross-validates and synthesizes automatically.",
  inputSchema: z.object({
    question: z
      .string()
      .min(1)
      .describe("The research question to investigate."),
    objective: z
      .string()
      .optional()
      .describe("The user's actual objective behind the question."),
    scope: z
      .string()
      .optional()
      .describe("Optional scope: what is in and out of scope."),
    constraints: z
      .array(z.string())
      .optional()
      .describe("Hard constraints the research must respect."),
    freshnessRequirement: z
      .enum(["current", "recent", "historical", "any"])
      .optional()
      .describe("How fresh the evidence must be (current for versions/pricing)."),
    preferredSources: z
      .array(z.string())
      .optional()
      .describe("Source kinds or hosts to prefer (e.g. official docs)."),
    excludedSources: z
      .array(z.string())
      .optional()
      .describe("Hosts or source kinds to avoid."),
    expectedOutput: z
      .string()
      .optional()
      .describe("What the consumer expects from the report (e.g. comparison)."),
    depth: z
      .enum(["quick", "standard", "deep"])
      .optional()
      .describe("Optional override for the automatic research depth."),
    maxRuntimeMs: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional hard time budget in milliseconds."),
  }),
  execute: async (input: {
    question: string;
    objective?: string;
    scope?: string;
    constraints?: string[];
    freshnessRequirement?: "current" | "recent" | "historical" | "any";
    preferredSources?: string[];
    excludedSources?: string[];
    expectedOutput?: string;
    depth?: "quick" | "standard" | "deep";
    maxRuntimeMs?: number;
  }) => {
    try {
      const request = {
        question: input.question,
        objective: input.objective,
        scope: input.scope,
        constraints: input.constraints,
        freshnessRequirement: input.freshnessRequirement,
        preferredSources: input.preferredSources,
        excludedSources: input.excludedSources,
        expectedOutput: input.expectedOutput,
        depth: input.depth,
      };

      const result = await runResearch(researchAgent, request, {
        depth: input.depth,
        maxRuntimeMs: input.maxRuntimeMs,
      });

      const base = {
        researching: true,
        status: result.status,
        question: result.question,
        sources: result.sources.map((s) => s.url).filter(Boolean),
      };

      if (result.status === "success" || result.status === "partial") {
        const summary = formatResearchSummary(result);
        return {
          ...base,
          summary,
          report: result,
        };
      }

      return {
        ...base,
        error:
          result.errors?.[0] ??
          (result.status === "blocked"
            ? "Research blocked: the research tools are unavailable."
            : "Research failed."),
        report: result,
      };
    } catch (error) {
      return {
        researching: true,
        status: "failed",
        question: input.question,
        error: error instanceof Error ? error.message : "Could not reach the Research Agent.",
      };
    }
  },
};