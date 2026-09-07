/**
 * Research runtime — the deterministic orchestration layer for the Research
 * Agent.
 *
 * The Research Agent (LLM) performs the actual searching, reading, reasoning
 * and reporting. This runtime wraps it in an explicit, bounded research loop:
 *
 *   request → understand → plan → [search → source discovery → reading →
 *   evidence extraction → gap detection]⁺ → cross-validation → synthesis →
 *   structured report
 *
 * The runtime enforces, in a deterministic and testable way, everything the
 * agent cannot be trusted to self-enforce:
 *   - hard iteration / search / read / time budgets,
 *   - stop conditions (completed, limit, timeout, blocked, failed, no tools),
 *   - structured JSON contracts at every phase,
 *   - error handling with the ResearchErrorCode vocabulary,
 *   - observability events (research started, plan created, pass completed,
 *     additional research triggered, research stopped, research completed).
 *
 * It mirrors the existing `runPlanner` pattern: the LLM reasons, the runtime
 * guarantees structure.
 */
import {
  researchPassResultSchema,
  researchPlanSchema,
  researchRequestSchema,
  researchResultSchema,
  researchSynthesisSchema,
} from "../domain/schemas";
import {
  ResearchErrorCode,
  ResearchStatus,
  ResearchStopReason,
} from "../domain/enums";
import { classifyDepth, inferFreshness } from "../services/depth-classifier";
import { resolveBudgets } from "../services/limits";
import {
  buildPlanningPrompt,
  clampPlan,
  MAX_PLAN_STEPS,
} from "../services/planning";
import {
  formatEvidenceDigest,
  formatSourceDigest,
  mergeState,
  remainingBudget,
} from "../services/evidence";
import type { ResearchAgentLike } from "../domain/contracts";
import type { ResearchBudgetOverrides } from "../domain/types";
import type {
  ResearchPlan,
  ResearchRequest,
  ResearchResult,
  ResearchState,
} from "../domain/types";

// ---------------------------------------------------------------------------
// Observability
// ---------------------------------------------------------------------------

function trace(message: string, ...args: unknown[]): void {
  if (process.env.RESEARCH_TRACE_DISABLED === "true") return;
  console.log(`[RESEARCH_TRACE] ${message}`, ...args);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type StructuredCall = {
  ok: true;
  object: unknown;
} | {
  ok: false;
  error: string;
};

async function generateStructured(
  agent: ResearchAgentLike,
  prompt: string,
  schema: unknown,
  label: string,
): Promise<StructuredCall> {
  try {
    const response = await agent.generate(prompt, {
      structuredOutput: {
        schema,
        jsonPromptInjection: "auto",
      },
    });
    if (response?.object != null) {
      return { ok: true, object: response.object };
    }
    return { ok: false, error: `Agent returned no structured object (${label}).` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    trace(`${label}: agent.generate() failed → ${message}`);
    return { ok: false, error: message };
  }
}

function classifyToolFailure(text: string): ResearchErrorCode {
  const t = text.toLowerCase();
  if (t.includes("search") && t.includes("fail")) return ResearchErrorCode.SEARCH_FAILED;
  if (t.includes("unreadable") || t.includes("could not parse") || t.includes("cannot read")) {
    return ResearchErrorCode.SOURCE_UNREADABLE;
  }
  if (
    t.includes("404") ||
    t.includes("not found") ||
    t.includes("unavailable") ||
    t.includes("unreachable") ||
    t.includes("could not fetch")
  ) {
    return ResearchErrorCode.SOURCE_UNAVAILABLE;
  }
  return ResearchErrorCode.SEARCH_FAILED;
}

// ---------------------------------------------------------------------------
// Runtime options
// ---------------------------------------------------------------------------

export interface RunResearchOptions {
  depth?: ResearchRequest["depth"];
  maxIterations?: number;
  maxSearches?: number;
  maxReads?: number;
  maxRuntimeMs?: number;
}

/** Build the per-pass prompt for the iterative research loop. */
function buildPassPrompt(
  request: ResearchRequest,
  plan: ResearchPlan,
  state: ResearchState,
  passNumber: number,
  remaining: { searches: number; reads: number; iterations: number },
  focusGaps: string[],
): string {
  const step = plan.steps[passNumber - 1];
  const sections: string[] = [];

  sections.push(
    `You are Compagnon's Research Agent. This is research pass ${passNumber} of the research loop.`,
  );
  sections.push(`RESEARCH QUESTION:
${request.question}`);

  if (plan.subQuestions.length) {
    sections.push(`SUB-QUESTIONS:\n${plan.subQuestions.map((q) => `- ${q}`).join("\n")}`);
  }

  if (step) {
    sections.push(`FOCUS STEP:
- Intent: ${step.intent}
- Suggested queries: ${step.queries.join(" | ")}
- Suggested tools: ${step.tools.join(", ")}`);
  }

  if (focusGaps.length) {
    sections.push(`TARGETED SEARCH — gaps to fill from previous passes:\n${focusGaps.map((g) => `- ${g}`).join("\n")}`);
  }

  if (request.expectedOutput) {
    sections.push(`EXPECTED OUTPUT: ${request.expectedOutput}`);
  }
  if (request.excludedSources?.length) {
    sections.push(`EXCLUDED SOURCES: ${request.excludedSources.join(", ")}`);
  }

  sections.push(`TOOLS (use purposefully, never all of them):
- web_search: discovery, current information, pricing, news.
- web_fetch: read the actual source once discovered. Read only the relevant sections; never download whole documents.
- github tools: open-source projects — repositories, releases, licenses, activity, READMEs.
- documentation tools: official docs / package registry.

SOURCE HIERARCHY (prefer this order): official documentation → official repository → primary source → official announcement → academic/institutional → reputable technical publications → community discussions → search-result summaries. Search snippets are NOT sufficient evidence for important claims.

EVIDENCE MODEL:
- Every important claim → Evidence { id, claim, supports, sourceIds }.
- Every Evidence → one or more Source { id, url, title, publisher, category, accessedAt, note }.
- Only record sources you actually consulted; never fabricate.

BUDGET FOR THIS PASS (hard):
- searches remaining total: ${remaining.searches} (use at most ${Math.min(remaining.searches, 3)})
- reads remaining total: ${remaining.reads} (use at most ${Math.min(remaining.reads, 4)})
- iterations remaining total: ${remaining.iterations}

ALREADY GATHERED (do not re-consult unless strictly necessary):
SOURCES:
${formatSourceDigest(state)}

EVIDENCE:
${formatEvidenceDigest(state)}

OUTPUT CONTRACT — EXACTLY ONE JSON object, no prose:\n
{
  "status": "completed" | "incomplete" | "blocked",
  "searchesPerformed": 0,
  "readsPerformed": 0,
  "sources": [
    { "id": "s1", "url": "...", "title": "...", "publisher": "...", "category": "official_documentation", "publishedAt": "YYYY-MM-DD", "accessedAt": "YYYY-MM-DD", "retrievalMethod": "search", "note": "what the source says" }
  ],
  "evidence": [
    { "id": "e1", "claim": "...", "quote": "short verbatim excerpt", "supports": true, "sourceIds": ["s1"] }
  ],
  "gaps": ["remaining unanswered sub-question"],
  "toolFailures": ["search failed: ..."],
  "toolsAvailable": true,
  "additionalSearchesSuggested": false,
  "blockedReason": "only when status=blocked"
}\n
RULES:
1. status="completed" when the sub-questions are adequately answered AND additional searches are unlikely to materially improve the result.
2. status="incomplete" when gaps remain that targeted search could resolve. Record the gaps.
3. status="blocked" when the search/read tools failed entirely (toolsAvailable=false) or a hard blocker appeared; explain in blockedReason.
4. toolsAvailable=false only if the research tools are missing or all failed.
5. Report the real number of searches/reads you performed this pass in searchesPerformed/readsPerformed.
6. Search queries become progressively more specific using previous discoveries.
7. When sources disagree, record BOTH sides as evidence (supports=true and supports=false). Do not silently choose one.
8. For current state (versions, pricing, support), prefer the freshest official source and record its date. Never present stale info as current.
9. Keep note/quote short; summarize rather than dumping whole pages.`,
  );

  return sections.join("\n\n");
}

/** Build the final synthesis prompt. */
function buildSynthesisPrompt(
  request: ResearchRequest,
  plan: ResearchPlan,
  state: ResearchState,
): string {
  const sections: string[] = [];

  sections.push(
    `You are Compagnon's Research Agent. Produce the final research report from the gathered evidence.`,
  );
  sections.push(`RESEARCH QUESTION:
${request.question}`);

  if (request.expectedOutput) {
    sections.push(`EXPECTED OUTPUT: ${request.expectedOutput}`);
  }
  if (plan.subQuestions.length) {
    sections.push(`SUB-QUESTIONS:\n${plan.subQuestions.map((q) => `- ${q}`).join("\n")}`);
  }

  sections.push(`SOURCES (only these may be cited):
${formatSourceDigest(state)}`);

  sections.push(`EVIDENCE:
${formatEvidenceDigest(state)}`);

  sections.push(`SYNTHESIS TASKS:
1. Cross-validate the important claims across sources.
2. Detect contradictions: sources making incompatible claims. Investigate the disagreement (version/date/edition/pricing tier). Mark resolved when you can explain the difference; otherwise leave unresolved. Unresolved contradictions MUST appear in the report.
3. Identify uncertainties: what could not be verified and why. "No evidence found" is NOT the same as "the claim is false".
4. Validate citations: every finding must reference evidence ids listed above; every evidence must reference source ids listed above.
5. Produce answer, executiveSummary, findings, contradictions, uncertainties, recommendations.
6. findings carry confidence (high/medium/low) and a confidenceBasis string[] explaining the basis (e.g. ["official documentation", "corroborated by 2 sources"]).
7. Never fabricate sources. Only cite sources listed above.
8. When important contradictions remain unresolved, mention them explicitly in the executive summary.

OUTPUT CONTRACT — EXACTLY ONE JSON object, no prose:\n
{
  "answer": "...",
  "executiveSummary": "...",
  "findings": [
    { "id": "f1", "statement": "...", "confidence": "high" | "medium" | "low", "confidenceBasis": ["..."], "importance": "core" | "supporting" | "contextual", "evidenceIds": ["e1"] }
  ],
  "contradictions": [
    { "id": "c1", "description": "...", "claims": ["...", "..."], "evidenceIds": ["e1", "e2"], "resolved": true, "resolution": "..." }
  ],
  "uncertainties": [
    { "id": "u1", "description": "...", "impact": "...", "sourceIds": ["s1"] }
  ],
  "recommendations": [
    { "id": "r1", "text": "...", "confidence": "high" | "medium" | "low", "evidenceIds": ["f1"] }
  ],
  "insufficientEvidence": false,
  "notes": ["optional observations"]
}\n
Return the JSON only.`);

  return sections.join("\n\n");
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Run a full research workflow against an agent-like instance. The agent can be
 * the real Research Agent or a test double.
 */
export async function runResearch(
  agent: ResearchAgentLike,
  request: ResearchRequest,
  options: RunResearchOptions = {},
): Promise<ResearchResult> {
  const startedAt = Date.now();

  // --- Understand & classify -------------------------------------------------
  const parsedRequest = researchRequestSchema.safeParse(request);
  if (!parsedRequest.success) {
    trace("invalid request", parsedRequest.error.issues.slice(0, 3));
    return buildShellResult(
      ResearchStatus.FAILED,
      request.question ?? "",
      classifyDepth(request?.question ?? ""),
      [],
      [],
      [],
      [],
      {
        errors: [
          "Invalid research request: " +
            parsedRequest.error.issues
              .slice(0, 3)
              .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
              .join(" | "),
        ],
        warnings: [ResearchErrorCode.INSUFFICIENT_EVIDENCE],
        stoppedReason: ResearchStopReason.FAILED,
      },
    );
  }

  const effectiveDepth = options.depth ?? request.depth ?? classifyDepth(request.question);
  const freshness = inferFreshness(request);
  const budgets = resolveBudgets(effectiveDepth, {
    maxIterations: options.maxIterations,
    maxSearches: options.maxSearches,
    maxReads: options.maxReads,
    maxRuntimeMs: options.maxRuntimeMs,
  });

  trace("research started", {
    question: request.question.slice(0, 120),
    depth: effectiveDepth,
    freshness,
    budgets: {
      maxIterations: budgets.maxIterations,
      maxSearches: budgets.maxSearches,
      maxReads: budgets.maxReads,
      maxRuntimeMs: budgets.maxRuntimeMs,
    },
  });

  // --- Plan -------------------------------------------------------------------
  const planning = await generateStructured(
    agent,
    buildPlanningPrompt(request, effectiveDepth, freshness),
    researchPlanSchema,
    "planning",
  );

  if (!planning.ok) {
    return buildShellResult(
      ResearchStatus.FAILED,
      request.question,
      effectiveDepth,
      [],
      [],
      [],
      [],
      {
        errors: [`Research planning failed: ${planning.error}`],
        warnings: [ResearchErrorCode.INSUFFICIENT_EVIDENCE],
        stoppedReason: ResearchStopReason.FAILED,
        researchedAt: new Date().toISOString(),
      },
    );
  }

  const planCheck = researchPlanSchema.safeParse(planning.object);
  if (!planCheck.success) {
    trace("planning: schema validation failed", planCheck.error.issues.slice(0, 3));
    return buildShellResult(
      ResearchStatus.FAILED,
      request.question,
      effectiveDepth,
      [],
      [],
      [],
      [],
      {
        errors: ["Research planning produced an invalid plan."],
        warnings: [ResearchErrorCode.INSUFFICIENT_EVIDENCE],
        stoppedReason: ResearchStopReason.FAILED,
        researchedAt: new Date().toISOString(),
      },
    );
  }

  const plan = clampPlan(planCheck.data, MAX_PLAN_STEPS[effectiveDepth]);
  trace("research plan created", {
    depth: plan.depth,
    subQuestions: plan.subQuestions.length,
    steps: plan.steps.length,
  });

  // --- Iterative research loop -------------------------------------------------
  let state: ResearchState = { sources: [], evidence: [], findings: [] };
  const failures: string[] = [];
  let searchesUsed = 0;
  let readsUsed = 0;
  let iterationsUsed = 0;
  let stopReason: ResearchStopReason | null = null;
  let blockedReason: string | null = null;
  let uncoveredGaps: string[] = [];

  for (let pass = 1; pass <= budgets.maxIterations; pass++) {
    iterationsUsed = pass;

    if (Date.now() - startedAt >= budgets.maxRuntimeMs) {
      stopReason = ResearchStopReason.TIME_EXPIRED;
      trace("research stopped: time expired", { iterationsUsed });
      break;
    }

    const remaining = remainingBudget(
      { searches: searchesUsed, reads: readsUsed, iterations: iterationsUsed },
      budgets,
    );

    if (remaining.searches === 0 && remaining.reads === 0) {
      stopReason = ResearchStopReason.LIMIT_REACHED;
      trace("research stopped: budget exhausted", { searchesUsed, readsUsed });
      break;
    }

    const prompt = buildPassPrompt(
      request,
      plan,
      state,
      pass,
      remaining,
      uncoveredGaps,
    );

    trace(`research pass ${pass} started`, {
      remainingSearches: remaining.searches,
      remainingReads: remaining.reads,
      focusedGaps: uncoveredGaps.slice(0, 3),
    });

    const passCall = await generateStructured(
      agent,
      prompt,
      researchPassResultSchema,
      `research pass ${pass}`,
    );

    if (!passCall.ok) {
      failures.push(`pass ${pass}: ${passCall.error}`);
      stopReason = ResearchStopReason.FAILED;
      trace("research stopped: pass failed", { pass, error: passCall.error });
      break;
    }

    const passCheck = researchPassResultSchema.safeParse(passCall.object);
    if (!passCheck.success) {
      failures.push(
        `pass ${pass}: result failed validation: ${passCheck.error.issues
          .slice(0, 3)
          .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
          .join(" | ")}`,
      );
      stopReason = ResearchStopReason.FAILED;
      trace("research stopped: pass schema invalid", { pass });
      break;
    }

    const passResult = passCheck.data;
    state = mergeState(state, passResult);

    searchesUsed = Math.min(
      budgets.maxSearches,
      searchesUsed + passResult.searchesPerformed,
    );
    readsUsed = Math.min(budgets.maxReads, readsUsed + passResult.readsPerformed);

    for (const failure of passResult.toolFailures) {
      failures.push(failure);
    }

    trace(`research pass ${pass} completed`, {
      status: passResult.status,
      newSources: passResult.sources.length,
      newEvidence: passResult.evidence.length,
      searchesUsed,
      readsUsed,
      gaps: passResult.gaps.length,
      additionalSearchesSuggested: passResult.additionalSearchesSuggested,
    });

    if (!passResult.toolsAvailable) {
      stopReason = ResearchStopReason.NO_TOOLS;
      blockedReason = passResult.blockedReason ?? "No research tools available.";
      trace("research stopped: no tools", { reason: blockedReason });
      break;
    }

    if (passResult.status === "blocked") {
      stopReason = ResearchStopReason.BLOCKED;
      blockedReason = passResult.blockedReason ?? "Research blocked.";
      trace("research stopped: blocked", { reason: blockedReason });
      break;
    }

    if (passResult.status === "completed") {
      stopReason = ResearchStopReason.COMPLETED;
      trace("research stopped: completed");
      break;
    }

    uncoveredGaps = passResult.gaps;
    if (uncoveredGaps.length === 0 && !passResult.additionalSearchesSuggested) {
      stopReason = ResearchStopReason.COMPLETED;
      trace("research stopped: no remaining gaps");
      break;
    }

    if (searchesUsed >= budgets.maxSearches || readsUsed >= budgets.maxReads) {
      stopReason = ResearchStopReason.LIMIT_REACHED;
      trace("research stopped: budget exhausted", { searchesUsed, readsUsed });
      break;
    }

    trace("additional research triggered", {
      gaps: uncoveredGaps.slice(0, 3),
      nextPass: pass + 1,
    });
  }

  if (stopReason === null) {
    stopReason = ResearchStopReason.LIMIT_REACHED;
    trace("research stopped: max iterations reached");
  }

  const noTools = stopReason === ResearchStopReason.NO_TOOLS;
  const blocked = stopReason === ResearchStopReason.BLOCKED;
  const failed = stopReason === ResearchStopReason.FAILED;
  const hasEvidence = state.sources.length > 0 || state.evidence.length > 0;

  // --- Synthesis ---------------------------------------------------------------
  let synthesis: (typeof researchSynthesisSchema)["_output"] | null = null;
  let synthesisError: string | null = null;

  if (!noTools && !(blocked && !hasEvidence) && !(failed && !hasEvidence)) {
    const t0 = Date.now();
    trace("synthesis started");
    const synthCall = await generateStructured(
      agent,
      buildSynthesisPrompt(request, plan, state),
      researchSynthesisSchema,
      "synthesis",
    );
    trace("synthesis completed", { tookMs: Date.now() - t0 });

    if (synthCall.ok) {
      const synthCheck = researchSynthesisSchema.safeParse(synthCall.object);
      if (synthCheck.success) {
        synthesis = synthCheck.data;
      } else {
        synthesisError =
          "Synthesis result failed validation: " +
          synthCheck.error.issues
            .slice(0, 3)
            .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
            .join(" | ");
      }
    } else {
      synthesisError = synthCall.error;
    }
  }

  // --- Assemble result ----------------------------------------------------------
  const answer = synthesis?.answer;
  const errors = synthesizeErrors({
    stopReason,
    blockedReason,
    failures,
    synthesisError,
    insufficientEvidence: synthesis?.insufficientEvidence,
    unresolvedContradictions: synthesis?.contradictions.filter((c) => !c.resolved) ?? [],
  });

  let status: ResearchStatus;
  if (noTools || blocked) {
    status = ResearchStatus.BLOCKED;
  } else if (failed) {
    status = ResearchStatus.FAILED;
  } else if (synthesis?.answer?.trim()) {
    status = synthesis.insufficientEvidence ? ResearchStatus.PARTIAL : ResearchStatus.SUCCESS;
  } else {
    status = ResearchStatus.PARTIAL;
  }

  trace("research completed", { status, iterationsUsed, searchesUsed, readsUsed, stopReason });

  const result: ResearchResult = {
    status,
    question: request.question,
    answer: answer ?? "",
    executiveSummary: synthesis?.executiveSummary ?? "",
    findings: synthesis?.findings ?? [],
    evidence: state.evidence,
    sources: state.sources,
    contradictions: synthesis?.contradictions ?? [],
    uncertainties: synthesis?.uncertainties ?? [],
    recommendations: synthesis?.recommendations ?? [],
    errors,
    warnings: synthesis?.notes,
    limits: {
      requestedDepth: effectiveDepth,
      maxIterations: budgets.maxIterations,
      maxSearches: budgets.maxSearches,
      maxReads: budgets.maxReads,
      maxRuntimeMs: budgets.maxRuntimeMs,
      iterationsUsed,
      searchesUsed,
      readsUsed,
      stoppedReason: stopReason,
    },
    researchedAt: new Date().toISOString(),
  };

  const finalCheck = researchResultSchema.safeParse(result);
  if (!finalCheck.success) {
    trace(
      "result failed final validation; returning degraded shell",
      finalCheck.error.issues.slice(0, 3),
    );
    return buildShellResult(
      ResearchStatus.PARTIAL,
      request.question,
      effectiveDepth,
      state.sources,
      state.evidence,
      synthesis?.findings ?? [],
      synthesis?.contradictions ?? [],
      {
        errors: [
          "Research result failed final validation: " +
            finalCheck.error.issues
              .slice(0, 3)
              .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
              .join(" | "),
        ],
        warnings: errors,
        budgets,
        iterationsUsed,
        searchesUsed,
        readsUsed,
        stoppedReason: stopReason,
      },
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Result construction helpers
// ---------------------------------------------------------------------------

function synthesizeErrors(args: {
  stopReason: ResearchStopReason;
  blockedReason: string | null;
  failures: string[];
  synthesisError: string | null;
  insufficientEvidence: boolean | undefined;
  unresolvedContradictions: unknown[];
}): string[] {
  const errors: string[] = [];

  if (args.stopReason === ResearchStopReason.NO_TOOLS) {
    errors.push(ResearchErrorCode.RESEARCH_TOOL_UNAVAILABLE);
  }
  if (args.stopReason === ResearchStopReason.TIME_EXPIRED) {
    errors.push(ResearchErrorCode.RESEARCH_TIMEOUT);
  }
  if (args.stopReason === ResearchStopReason.LIMIT_REACHED) {
    errors.push(ResearchErrorCode.RESEARCH_LIMIT_REACHED);
  }
  if (args.stopReason === ResearchStopReason.BLOCKED && args.blockedReason) {
    errors.push(args.blockedReason);
  }
  if (args.stopReason === ResearchStopReason.FAILED) {
    errors.push(
      args.failures[0] ??
        (args.synthesisError
          ? `Synthesis failed: ${args.synthesisError}`
          : "Research pass failed."),
    );
  }
  if (args.synthesisError) {
    errors.push(args.synthesisError);
  }
  for (const failure of args.failures) {
    errors.push(`${classifyToolFailure(failure)}: ${failure}`);
  }
  if (args.insufficientEvidence) {
    errors.push(ResearchErrorCode.INSUFFICIENT_EVIDENCE);
  }
  if (args.unresolvedContradictions.length > 0) {
    errors.push(ResearchErrorCode.CONTRADICTORY_SOURCES);
  }

  return errors;
}

function buildShellResult(
  status: ResearchStatus,
  question: string,
  requestedDepth: string,
  sources: Array<Record<string, unknown>>,
  evidence: Array<Record<string, unknown>>,
  findings: Array<Record<string, unknown>>,
  contradictions: Array<Record<string, unknown>>,
  args: {
    errors?: string[];
    warnings?: string[];
    budgets?: ResearchBudgetOverrides;
    iterationsUsed?: number;
    searchesUsed?: number;
    readsUsed?: number;
    stoppedReason?: ResearchStopReason;
    researchedAt?: string;
  },
): ResearchResult {
  const reason = args.stoppedReason ?? ResearchStopReason.FAILED;
  return {
    status,
    question,
    answer: "",
    executiveSummary: "",
    findings: findings as ResearchResult["findings"],
    evidence: evidence as ResearchResult["evidence"],
    sources: sources as ResearchResult["sources"],
    contradictions: contradictions as ResearchResult["contradictions"],
    uncertainties: [],
    recommendations: [],
    errors: args.errors,
    warnings: args.warnings,
    limits: {
      requestedDepth: requestedDepth as ResearchResult["limits"]["requestedDepth"],
      maxIterations: args.budgets?.maxIterations ?? 1,
      maxSearches: args.budgets?.maxSearches ?? 1,
      maxReads: args.budgets?.maxReads ?? 1,
      maxRuntimeMs: args.budgets?.maxRuntimeMs ?? 60_000,
      iterationsUsed: args.iterationsUsed ?? 0,
      searchesUsed: args.searchesUsed ?? 0,
      readsUsed: args.readsUsed ?? 0,
      stoppedReason: reason,
    },
    researchedAt: args.researchedAt ?? new Date().toISOString(),
  };
}