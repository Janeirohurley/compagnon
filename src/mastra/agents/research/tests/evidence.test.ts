import { describe, it, expect } from "vitest";
import {
  deriveConfidence,
  mergeState,
  remainingBudget,
} from "../services/evidence";
import { ConfidenceLevel, SourceCategory } from "../domain/enums";
import type { Evidence, ResearchPassResult, ResearchState, Source } from "../domain/types";

const docSource: Source = {
  id: "s1",
  url: "https://docs.example.com",
  title: "Official Docs",
  category: SourceCategory.OFFICIAL_DOCUMENTATION,
  accessedAt: "2026-01-01",
};

const blogSource: Source = {
  id: "s2",
  url: "https://blog.example.com",
  title: "Some Blog",
  category: SourceCategory.COMMUNITY_DISCUSSION,
  accessedAt: "2026-01-02",
};

describe("mergeState", () => {
  it("accumulates sources and evidence across passes, deduplicating by id", () => {
    const state: ResearchState = { sources: [docSource], evidence: [], findings: [] };

    const pass: ResearchPassResult = {
      status: "incomplete",
      searchesPerformed: 1,
      readsPerformed: 1,
      sources: [{ ...docSource, note: "updated" }, blogSource],
      evidence: [
        {
          id: "e1",
          claim: "X is Y",
          supports: true,
          sourceIds: ["s1"],
        },
      ],
      gaps: [],
      toolFailures: [],
      toolsAvailable: true,
    };

    const merged = mergeState(state, pass);

    expect(merged.sources).toHaveLength(2);
    expect(merged.sources.find((s) => s.id === "s1")?.note).toBe("updated");
    expect(merged.evidence).toHaveLength(1);
    expect(state.sources).toHaveLength(1);
  });

  it("records both sides of a disagreement", () => {
    const state: ResearchState = { sources: [docSource], evidence: [], findings: [] };
    const pass: ResearchPassResult = {
      status: "completed",
      searchesPerformed: 0,
      readsPerformed: 0,
      sources: [docSource],
      evidence: [
        { id: "e1", claim: "X supports Y", supports: true, sourceIds: ["s1"] },
        { id: "e2", claim: "X does not support Y", supports: false, sourceIds: ["s1"] },
      ],
      gaps: [],
      toolFailures: [],
      toolsAvailable: true,
    };
    const merged = mergeState(state, pass);
    expect(merged.evidence.filter((e) => e.supports)).toHaveLength(1);
    expect(merged.evidence.filter((e) => !e.supports)).toHaveLength(1);
  });
});

describe("deriveConfidence", () => {
  const supportingOfficial: Evidence[] = [
    { id: "e1", claim: "c", supports: true, sourceIds: ["s1"] },
    { id: "e2", claim: "c", supports: true, sourceIds: ["s2"] },
  ];

  it("returns LOW without evidence", () => {
    expect(deriveConfidence([], [docSource])).toBe(ConfidenceLevel.LOW);
  });

  it("returns HIGH for official sources corroborated by 2+ sources", () => {
    expect(deriveConfidence(supportingOfficial, [docSource, blogSource])).toBe(
      ConfidenceLevel.HIGH,
    );
  });

  it("returns MEDIUM for a single official source", () => {
    expect(
      deriveConfidence([{ ...supportingOfficial[0] }], [docSource]),
    ).toBe(ConfidenceLevel.MEDIUM);
  });

  it("returns LOW when only community discussion corroborates", () => {
    const evidence: Evidence[] = [
      { id: "e1", claim: "c", supports: true, sourceIds: ["s2"] },
    ];
    expect(deriveConfidence(evidence, [blogSource])).toBe(ConfidenceLevel.LOW);
  });

  it("returns LOW when only contradicting evidence exists", () => {
    const evidence: Evidence[] = [
      { id: "e1", claim: "c", supports: false, sourceIds: ["s1"] },
    ];
    expect(deriveConfidence(evidence, [docSource])).toBe(ConfidenceLevel.LOW);
  });
});

describe("remainingBudget", () => {
  it("computes the remaining budget, clamped at zero", () => {
    const budgets = { maxIterations: 3, maxSearches: 6, maxReads: 8, maxRuntimeMs: 1000 };
    expect(remainingBudget({ searches: 2, reads: 3, iterations: 1 }, budgets)).toEqual({
      searches: 4,
      reads: 5,
      iterations: 2,
    });
    expect(remainingBudget({ searches: 9, reads: 3, iterations: 4 }, budgets)).toEqual({
      searches: 0,
      reads: 5,
      iterations: 0,
    });
  });
});