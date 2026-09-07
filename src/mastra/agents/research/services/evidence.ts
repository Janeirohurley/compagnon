/**
 * Evidence management helpers for the Research Agent runtime.
 *
 * These functions are pure and deterministic: they merge accumulated research
 * state, compute categorical confidence from a documented basis, pick the stop
 * reason, and build the compact digests that are injected into LLM prompts.
 */
import {
  ConfidenceLevel,
  SOURCE_CATEGORY_PRECEDENCE,
  SourceCategory,
  ResearchStopReason,
} from "../domain/enums";
import type {
  ResearchPassResult,
  ResearchState,
  ResearchBudgetOverrides,
  Source,
  Evidence,
} from "../domain/types";

/**
 * Merge a research pass into the accumulated state, deduplicating by primary
 * key (source.id, evidence.id).
 */
export function mergeState(
  state: ResearchState,
  pass: ResearchPassResult,
): ResearchState {
  const sourcesById = new Map(state.sources.map((s) => [s.id, s]));
  for (const source of pass.sources) {
    sourcesById.set(source.id, source);
  }

  const evidenceById = new Map(state.evidence.map((e) => [e.id, e]));
  for (const item of pass.evidence) {
    evidenceById.set(item.id, item);
  }

  return {
    sources: [...sourcesById.values()],
    evidence: [...evidenceById.values()],
    findings: state.findings,
  };
}

/**
 * Documented confidence calculation.
 *
 * confidence is derived from (a) the authority of the best supporting source,
 * ranked by SOURCE_CATEGORY_PRECEDENCE, and (b) how many independent sources
 * corroborate the finding:
 *
 * - HIGH   ← best source is primary/official AND at least 2 corroborating sources
 * - HIGH   ← best source is primary/official AND 1 corroborating source + no contradiction
 * - MEDIUM ← best source is a reputable secondary source, or 1 primary source alone
 * - LOW    ← only search summaries / community discussion, or 1 secondary source
 */
export function deriveConfidence(
  evidenceItems: Evidence[],
  sources: Source[],
): ConfidenceLevel {
  if (evidenceItems.length === 0) return ConfidenceLevel.LOW;

  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const supporting = evidenceItems.filter((e) => e.supports);
  const contradicting = evidenceItems.filter((e) => !e.supports);

  if (contradicting.length > 0 && supporting.length === 0) {
    return ConfidenceLevel.LOW;
  }

  const categories = supporting.flatMap((e) =>
    e.sourceIds
      .map((id) => sourceById.get(id)?.category)
      .filter((c): c is SourceCategory => Boolean(c)),
  );

  if (categories.length === 0) return ConfidenceLevel.LOW;

  let bestRank = Number.POSITIVE_INFINITY;
  for (const category of categories) {
    const rank = SOURCE_CATEGORY_PRECEDENCE.indexOf(category);
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
    }
  }

  const bestCategory = SOURCE_CATEGORY_PRECEDENCE[bestRank];

  const primaryOrOfficial = (
    [
      SourceCategory.OFFICIAL_DOCUMENTATION,
      SourceCategory.OFFICIAL_REPOSITORY,
      SourceCategory.PRIMARY_SOURCE,
      SourceCategory.OFFICIAL_ANNOUNCEMENT,
      SourceCategory.ACADEMIC,
    ] as SourceCategory[]
  ).includes(bestCategory);

  const distinctSources = new Set(supporting.flatMap((e) => e.sourceIds)).size;

  if (primaryOrOfficial && distinctSources >= 2) return ConfidenceLevel.HIGH;
  if (primaryOrOfficial && distinctSources === 1) return ConfidenceLevel.MEDIUM;
  if (distinctSources >= 2) return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

/** Rank of a source category (lower = more authoritative). */
export function categoryPrecedence(category: SourceCategory): number {
  const rank = SOURCE_CATEGORY_PRECEDENCE.indexOf(category);
  return rank === -1 ? SOURCE_CATEGORY_PRECEDENCE.length : rank;
}

/**
 * Decide the stop reason for a completed research loop, honoring precedence:
 * blocked > failed > no_tools > time > limit > completed.
 */
export function pickStopReason(args: {
  completable: boolean;
  exhausted: boolean;
  timedOut: boolean;
  blocked: boolean;
  failed: boolean;
  noTools: boolean;
}): ResearchStopReason {
  if (args.blocked) return ResearchStopReason.BLOCKED;
  if (args.failed) return ResearchStopReason.FAILED;
  if (args.noTools) return ResearchStopReason.NO_TOOLS;
  if (args.timedOut) return ResearchStopReason.TIME_EXPIRED;
  if (args.exhausted) return ResearchStopReason.LIMIT_REACHED;
  return ResearchStopReason.COMPLETED;
}

/** Compact digest of the accumulated sources for a synthesis prompt. */
export function formatSourceDigest(state: ResearchState): string {
  if (state.sources.length === 0) return "(no sources gathered)";

  return state.sources
    .map((s: Source) => {
      const url = s.url ? ` (${s.url})` : "";
      const note = s.note ? ` — ${s.note}` : "";
      return `- [${s.id}] ${s.title ?? s.publisher ?? s.category}${url} [${s.category}]${note}`;
    })
    .join("\n");
}

/** Compact digest of the accumulated evidence for a synthesis prompt. */
export function formatEvidenceDigest(state: ResearchState): string {
  if (state.evidence.length === 0) return "(no evidence extracted)";

  return state.evidence
    .map((e) => `- [${e.id}] ${e.supports ? "supports" : "contradicts"}: ${e.claim} (sources: ${e.sourceIds.join(", ")})`)
    .join("\n");
}

/** Compute remaining budget. */
export function remainingBudget(
  used: { searches: number; reads: number; iterations: number },
  budgets: ResearchBudgetOverrides,
): { searches: number; reads: number; iterations: number } {
  return {
    searches: Math.max(0, budgets.maxSearches - used.searches),
    reads: Math.max(0, budgets.maxReads - used.reads),
    iterations: Math.max(0, budgets.maxIterations - used.iterations),
  };
}