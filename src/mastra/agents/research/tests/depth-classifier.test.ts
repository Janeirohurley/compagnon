import { describe, it, expect } from "vitest";
import {
  classifyDepth,
  inferFreshness,
} from "../services/depth-classifier";
import {
  FreshnessRequirement,
  ResearchDepth,
} from "../domain/enums";

describe("classifyDepth", () => {
  it("classifies comparison / evaluation questions as DEEP", () => {
    expect(classifyDepth("Compare Mastra and LangChain for building AI agents")).toBe(
      ResearchDepth.DEEP,
    );
    expect(classifyDepth("Which ORM should we adopt for the project?")).toBe(
      ResearchDepth.DEEP,
    );
    expect(classifyDepth("Evaluating alternatives to NextAuth")).toBe(ResearchDepth.DEEP);
  });

  it("classifies short single-fact questions as QUICK", () => {
    expect(classifyDepth("What is the release date of Mastra 1.25?")).toBe(
      ResearchDepth.QUICK,
    );
  });

  it("classes long fact questions as STANDARD", () => {
    const question =
      "What is the release date of the very latest version of the Mastra framework " +
      "and where can I find the changelog covering it, including the release notes " +
      "and all the information about how it relates to previous releases since last year?";
    expect(question.length).toBeGreaterThan(140);
    expect(classifyDepth(question)).toBe(ResearchDepth.STANDARD);
  });

  it("is overridable: depth-keyword precedence beats quick keywords", () => {
    expect(classifyDepth("What is the pricing of Supabase pro plan?")).toBe(
      ResearchDepth.DEEP,
    );
  });
});

describe("inferFreshness", () => {
  it("returns the explicit freshness requirement when present", () => {
    expect(
      inferFreshness({
        question: "x",
        freshnessRequirement: FreshnessRequirement.HISTORICAL,
      }),
    ).toBe(FreshnessRequirement.HISTORICAL);
  });

  it("maps time-sensitive wording to CURRENT", () => {
    expect(inferFreshness({ question: "What is the latest stable release?" })).toBe(
      FreshnessRequirement.CURRENT,
    );
  });

  it("defaults to RECENT otherwise", () => {
    expect(inferFreshness({ question: "How does Mastra memory work?" })).toBe(
      FreshnessRequirement.RECENT,
    );
  });
});