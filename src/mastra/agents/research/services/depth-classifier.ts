/**
 * Deterministic research-depth classifier.
 *
 * Research depth must be proportional to complexity: simple factual questions
 * get a single search pass, complex questions get a multi-step plan. This
 * heuristic is pure and unit-testable; the caller can always override the
 * result via `request.depth` or runtime options.
 */
import { FreshnessRequirement, ResearchDepth } from "../domain/enums";
import type { ResearchRequest } from "../domain/types";

const DEEP_INDICATORS = [
  "compare",
  "comparison",
  "contrast",
  " vs ",
  "versus",
  "best",
  "recommend",
  "recommendation",
  "architecture",
  "choose",
  "select",
  "evaluate",
  "evaluation",
  "assessment",
  "alternatives",
  "options",
  "review",
  "migration",
  "migrate",
  "adopt",
  "adoption",
  "decide",
  "decision",
  "should we",
  "which one",
  "open source",
  "self-host",
  "self-hosted",
  "pricing",
  "cost",
  "benefits",
  "pros and cons",
  "criteria",
  "survey",
  "landscape",
];

const QUICK_INDICATORS = [
  "what is",
  "what's",
  "who is",
  "who's",
  "when",
  "where",
  "how many",
  "how much",
  "how long",
  "define",
  "meaning of",
  "capital of",
  "invented",
  "founded",
  "release date",
];

/**
 * Classify the required research depth from the question text.
 *
 * - DEEP: comparison / evaluation / recommendation / architecture questions,
 *   or questions with several distinct dimensions.
 * - QUICK: short, single-fact questions.
 * - STANDARD: everything in between.
 */
export function classifyDepth(question: string): ResearchDepth {
  const normalized = ` ${question.toLowerCase().trim()} `;

  const hasDeep = DEEP_INDICATORS.some((keyword) => normalized.includes(keyword));
  if (hasDeep) {
    return ResearchDepth.DEEP;
  }

  const hasQuick = QUICK_INDICATORS.some((keyword) => normalized.includes(keyword));
  if (hasQuick && question.trim().length <= 140) {
    return ResearchDepth.QUICK;
  }

  if (question.trim().length <= 140) {
    return ResearchDepth.STANDARD;
  }

  return ResearchDepth.STANDARD;
}

/**
 * Infer a freshness requirement when the request does not state one explicitly.
 * Time-sensitive wording ("latest", "currently", "today", "current pricing")
 * maps to "current".
 */
export function inferFreshness(request: ResearchRequest): string {
  if (request.freshnessRequirement) {
    return request.freshnessRequirement;
  }

  const question = request.question.toLowerCase();
  const currentIndicators = [
    "latest",
    "currently",
    "today",
    "as of",
    "this year",
    "2026",
    "current",
    "now",
    "up to date",
    "most recent",
    "recent release",
  ];

  if (currentIndicators.some((keyword) => question.includes(keyword))) {
    return FreshnessRequirement.CURRENT;
  }

  return FreshnessRequirement.RECENT;
}