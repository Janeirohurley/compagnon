import { describe, it, expect } from "vitest";
import { runResearch } from "../runtime/research-runtime";
import {
  ResearchErrorCode,
  ResearchStatus,
  ResearchStopReason,
} from "../domain/enums";
import type { ResearchAgentLike } from "../domain/contracts";
import type { ResearchPlan, ResearchRequest } from "../domain/types";

const plan: ResearchPlan = {
  depth: "quick",
  freshnessRequirement: "recent",
  subQuestions: ["What is X?"],
  steps: [{ id: "step1", intent: "find X", queries: ["X"], tools: ["web_search", "web_fetch"] }],
};

function makePass(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    status: "completed",
    searchesPerformed: 1,
    readsPerformed: 1,
    sources: [
      {
        id: "s1",
        url: "https://docs.example.com/x",
        title: "X docs",
        publisher: "Example",
        category: "official_documentation",
        accessedAt: "2026-01-01",
        note: "X is Y.",
      },
    ],
    evidence: [{ id: "e1", claim: "X is Y", quote: "X is Y", supports: true, sourceIds: ["s1"] }],
    gaps: [],
    toolFailures: [],
    toolsAvailable: true,
    ...overrides,
  };
}

function makeSynthesis(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    answer: "X is Y, which enables Z.",
    executiveSummary: "We found that X is Y.",
    findings: [
      {
        id: "f1",
        statement: "X is Y",
        confidence: "high",
        confidenceBasis: ["official documentation", "corroborated by 1 source"],
        importance: "core",
        evidenceIds: ["e1"],
      },
    ],
    contradictions: [],
    uncertainties: [
      { id: "u1", description: "Future versions may change Z.", impact: "Low", sourceIds: ["s1"] },
    ],
    recommendations: [],
    insufficientEvidence: false,
    notes: ["cross-validation done"],
    ...overrides,
  };
}

function fakeAgent(
  handler: (prompt: string) => { object?: unknown; text?: string },
  delayMs = 0,
): ResearchAgentLike {
  return {
    generate: async (prompt: string) => {
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      return handler(prompt);
    },
  };
}

function phasedFake(opts: {
  plan?: unknown;
  pass?: (prompt: string, passNumber: number) => { object?: unknown };
  synthesis?: unknown;
  calls?: { passes: number };
  delayMs?: number;
}) {
  let passCount = 0;
  return fakeAgent((prompt) => {
    if (prompt.includes("Produce a research plan")) {
      return { object: opts.plan ?? plan };
    }
    if (prompt.includes("Produce the final research report")) {
      return { object: opts.synthesis ?? undefined };
    }
    passCount += 1;
    if (opts.calls) opts.calls.passes = passCount;
    return opts.pass ? opts.pass(prompt, passCount) : { object: makePass() };
  }, opts.delayMs ?? 0);
}

describe("runResearch", () => {
  const request: ResearchRequest = {
    question: "What exactly is X and what does it enable?",
    depth: "quick",
  };

  it("returns a SUCCESS report with evidence, sources, and uncertainties", async () => {
    const agent = phasedFake({ synthesis: makeSynthesis() });
    const result = await runResearch(agent, request, { maxRuntimeMs: 30_000 });

    expect(result.status).toBe(ResearchStatus.SUCCESS);
    expect(result.answer).toBe("X is Y, which enables Z.");
    expect(result.sources).toHaveLength(1);
    expect(result.sources[0].url).toBe("https://docs.example.com/x");
    expect(result.evidence).toHaveLength(1);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].confidence).toBe("high");
    expect(result.uncertainties).toHaveLength(1);
    expect(result.limits.iterationsUsed).toBe(1);
    expect(result.limits.stoppedReason).toBe(ResearchStopReason.COMPLETED);
  });

  it("bounds the loop to maxIterations and does not loop forever", async () => {
    const calls = { passes: 0 };
    const agent = phasedFake({
      pass: (_prompt, passNumber) => ({
        object: makePass({
          status: "incomplete",
          gaps: [`gap ${passNumber}`],
          additionalSearchesSuggested: true,
          searchesPerformed: 1,
          readsPerformed: 0,
        }),
      }),
      synthesis: makeSynthesis({ insufficientEvidence: true }),
      calls,
    });

    const result = await runResearch(
      agent,
      request,
      { maxIterations: 2, maxSearches: 20, maxReads: 20, maxRuntimeMs: 30_000 },
    );

    expect(calls.passes).toBe(2);
    expect(result.limits.iterationsUsed).toBe(2);
    expect(result.limits.stoppedReason).toBe(ResearchStopReason.LIMIT_REACHED);
    expect(result.status).toBe(ResearchStatus.PARTIAL);
  });

  it("stops with NO_TOOLS when the pass reports tools unavailable and skips synthesis", async () => {
    const agent = phasedFake({
      pass: () => ({
        object: makePass({ toolsAvailable: false, blockedReason: "web_search unavailable" }),
      }),
    });

    const result = await runResearch(agent, request, { maxRuntimeMs: 30_000 });

    expect(result.status).toBe(ResearchStatus.BLOCKED);
    expect(result.limits.stoppedReason).toBe(ResearchStopReason.NO_TOOLS);
    expect(result.errors).toContain(ResearchErrorCode.RESEARCH_TOOL_UNAVAILABLE);
    expect(result.answer).toBe("");
  });

  it("reports BLOCKED when the pass is blocked with no gathered evidence", async () => {
    const agent = phasedFake({
      pass: () => ({
        object: makePass({ status: "blocked", blockedReason: "Everything 404s." }),
      }),
    });

    const result = await runResearch(agent, request, { maxRuntimeMs: 30_000 });

    expect(result.status).toBe(ResearchStatus.BLOCKED);
    expect(result.limits.stoppedReason).toBe(ResearchStopReason.BLOCKED);
    expect(result.errors?.[0]).toContain("404s");
  });

  it("surfaces unresolvable contradictions in errors", async () => {
    const agent = phasedFake({
      synthesis: makeSynthesis({
        contradictions: [
          {
            id: "c1",
            description: "Sources disagree about the API",
            claims: ["v2 uses REST", "v2 uses GraphQL"],
            evidenceIds: ["e1", "e2"],
            resolved: false,
          },
        ],
      }),
    });

    const result = await runResearch(agent, request, { maxRuntimeMs: 30_000 });

    expect(result.errors).toContain(ResearchErrorCode.CONTRADICTORY_SOURCES);
  });

  it("gracefully degrades when the planning call fails", async () => {
    const agent = fakeAgent(() => {
      throw new Error("model exploded");
    });

    const result = await runResearch(agent, request, { maxRuntimeMs: 30_000 });

    expect(result.status).toBe(ResearchStatus.FAILED);
    expect(result.answer).toBe("");
    expect(result.errors?.[0]).toContain("Research planning failed");
  });

  it("returns a FAILED shell for an invalid request", async () => {
    const agent = phasedFake({ synthesis: makeSynthesis() });
    const result = await runResearch(agent, { question: "" } as ResearchRequest);

    expect(result.status).toBe(ResearchStatus.FAILED);
    expect(result.errors?.[0]).toContain("Invalid research request");
  });

  it("stops with TIME_EXPIRED when the runtime budget is exceeded", async () => {
    // Artificial per-call latency makes the 1ms budget trip deterministically
    // instead of racing with a synchronous fake (fast machines used to complete
    // the whole run before the first budget check).
    const agent = phasedFake({ synthesis: makeSynthesis({ insufficientEvidence: true }), delayMs: 5 });
    const result = await runResearch(agent, request, { maxRuntimeMs: 1 });

    expect(result.limits.stoppedReason).toBe(ResearchStopReason.TIME_EXPIRED);
    expect(result.limits.iterationsUsed).toBeGreaterThanOrEqual(1);
    expect(result.errors).toContain(ResearchErrorCode.RESEARCH_TIMEOUT);
    expect(result.status).toBe(ResearchStatus.PARTIAL);
  });
});