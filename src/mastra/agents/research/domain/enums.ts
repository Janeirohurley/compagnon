/**
 * Research Agent domain enums.
 *
 * The Research Agent is a specialized worker: research → verify → synthesize →
 * report. It does not act as the main orchestrator.
 */

/** How thorough the research should be. Depth is proportional to complexity. */
export const ResearchDepth = {
  QUICK: "quick",
  STANDARD: "standard",
  DEEP: "deep",
} as const;

export type ResearchDepth = (typeof ResearchDepth)[keyof typeof ResearchDepth];

/** How fresh the evidence must be. */
export const FreshnessRequirement = {
  CURRENT: "current",
  RECENT: "recent",
  HISTORICAL: "historical",
  ANY: "any",
} as const;

export type FreshnessRequirement =
  (typeof FreshnessRequirement)[keyof typeof FreshnessRequirement];

/** Overall result status of a completed research run. */
export const ResearchStatus = {
  SUCCESS: "success",
  PARTIAL: "partial",
  BLOCKED: "blocked",
  FAILED: "failed",
} as const;

export type ResearchStatus = (typeof ResearchStatus)[keyof typeof ResearchStatus];

/** Why the research loop stopped. */
export const ResearchStopReason = {
  COMPLETED: "completed",
  LIMIT_REACHED: "limit_reached",
  TIME_EXPIRED: "time_expired",
  BLOCKED: "blocked",
  FAILED: "failed",
  NO_TOOLS: "no_tools",
} as const;

export type ResearchStopReason =
  (typeof ResearchStopReason)[keyof typeof ResearchStopReason];

/**
 * Categorised failures the Research Agent must handle. These mirror the
 * conceptual failure list from the research requirements:
 *
 * - RESEARCH_TOOL_UNAVAILABLE  search/read tools could not be used at all
 * - SEARCH_FAILED              a search call failed
 * - SOURCE_UNAVAILABLE         a source could not be reached
 * - SOURCE_UNREADABLE          a source was reached but could not be read
 * - INSUFFICIENT_EVIDENCE      not enough evidence to answer confidently
 * - RESEARCH_LIMIT_REACHED     configured limits were reached
 * - CONTRADICTORY_SOURCES      sources contradict and the conflict is unresolved
 * - RESEARCH_TIMEOUT           the research budget expired
 */
export const ResearchErrorCode = {
  RESEARCH_TOOL_UNAVAILABLE: "research_tool_unavailable",
  SEARCH_FAILED: "search_failed",
  SOURCE_UNAVAILABLE: "source_unavailable",
  SOURCE_UNREADABLE: "source_unreadable",
  INSUFFICIENT_EVIDENCE: "insufficient_evidence",
  RESEARCH_LIMIT_REACHED: "research_limit_reached",
  CONTRADICTORY_SOURCES: "contradictory_sources",
  RESEARCH_TIMEOUT: "research_timeout",
} as const;

export type ResearchErrorCode =
  (typeof ResearchErrorCode)[keyof typeof ResearchErrorCode];

/**
 * Authority ladder used to prefer better sources (roughly in this order,
 * depending on the subject). Kept as a ranking so the report can reason about
 * source quality without inventing arbitrary numeric scores.
 */
export const SourceCategory = {
  OFFICIAL_DOCUMENTATION: "official_documentation",
  OFFICIAL_REPOSITORY: "official_repository",
  PRIMARY_SOURCE: "primary_source",
  OFFICIAL_ANNOUNCEMENT: "official_announcement",
  ACADEMIC: "academic",
  TECHNICAL_PUBLICATION: "technical_publication",
  COMMUNITY_DISCUSSION: "community_discussion",
  SEARCH_SUMMARY: "search_summary",
  OTHER: "other",
} as const;

export type SourceCategory = (typeof SourceCategory)[keyof typeof SourceCategory];

/**
 * Source-authority ranking used to evaluate source quality. Higher precedence
 * means more authority for typical software research.
 */
export const SOURCE_CATEGORY_PRECEDENCE: SourceCategory[] = [
  SourceCategory.OFFICIAL_DOCUMENTATION,
  SourceCategory.OFFICIAL_REPOSITORY,
  SourceCategory.PRIMARY_SOURCE,
  SourceCategory.OFFICIAL_ANNOUNCEMENT,
  SourceCategory.ACADEMIC,
  SourceCategory.TECHNICAL_PUBLICATION,
  SourceCategory.COMMUNITY_DISCUSSION,
  SourceCategory.SEARCH_SUMMARY,
  SourceCategory.OTHER,
];

/**
 * Categorical confidence for findings. No arbitrary numeric scores: confidence
 * is derived from the highest-authority supporting source and the number of
 * corroborating sources (see `deriveConfidence`).
 */
export const ConfidenceLevel = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
} as const;

export type ConfidenceLevel = (typeof ConfidenceLevel)[keyof typeof ConfidenceLevel];

/**
 * Role of a finding relative to the research question.
 */
export const FindingImportance = {
  CORE: "core",
  SUPPORTING: "supporting",
  CONTEXTUAL: "contextual",
} as const;

export type FindingImportance =
  (typeof FindingImportance)[keyof typeof FindingImportance];