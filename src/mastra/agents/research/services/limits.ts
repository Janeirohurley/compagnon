/**
 * Research budget resolution.
 *
 * Budgets are depth-based defaults that can be overridden, in increasing order
 * of precedence:
 *   1. depth defaults
 *   2. environment variables (RESEARCH_MAX_ITERATIONS/SEARCHES/READS/RUNTIME_MS)
 *   3. explicit runtime options
 *
 * Enforced deterministically by the runtime so the Research Agent cannot loop
 * forever or exceed the configured ceilings.
 */
import { ResearchDepth } from "../domain/enums";
import {
  DEFAULT_LIMITS,
  type ResearchBudgetOverrides,
} from "../domain/types";

function readEnvInt(name: string): number | undefined {
  const raw = process.env[name];
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function resolveBudgets(
  depth: ResearchDepth,
  overrides?: Partial<ResearchBudgetOverrides>,
): ResearchBudgetOverrides {
  const defaults = DEFAULT_LIMITS[depth];

  return {
    maxIterations:
      overrides?.maxIterations ??
      readEnvInt("RESEARCH_MAX_ITERATIONS") ??
      defaults.maxIterations,
    maxSearches:
      overrides?.maxSearches ??
      readEnvInt("RESEARCH_MAX_SEARCHES") ??
      defaults.maxSearches,
    maxReads:
      overrides?.maxReads ??
      readEnvInt("RESEARCH_MAX_READS") ??
      defaults.maxReads,
    maxRuntimeMs:
      overrides?.maxRuntimeMs ??
      readEnvInt("RESEARCH_MAX_RUNTIME_MS") ??
      defaults.maxRuntimeMs,
  };
}