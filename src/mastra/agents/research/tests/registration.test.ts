import { describe, it, expect, beforeAll } from "vitest";

process.env.OMNIROUTE_BASE_URL = "https://api.omniroute.ai/v1";
process.env.OMNIROUTE_API_KEY = "test-key";
process.env.OMNIROUTE_MODEL = "gpt-4o-mini";
process.env.RESEARCH_TRACE_DISABLED = "true";

let researchAgent: any;
let researchInstructions: string;
let runResearch: (...args: any[]) => Promise<unknown>;

describe("Research Agent", () => {
  beforeAll(async () => {
    const mod = await import("../index");
    researchAgent = mod.createResearchAgent();
    researchInstructions = mod.researchInstructions;
    runResearch = mod.runResearch;
  });

  it("is constructed with the research id and name", () => {
    expect(researchAgent?.id).toBe("research");
    expect(researchAgent?.name).toBe("Research Agent");
  });

  it("has system instructions", () => {
    expect(researchInstructions).toBeTruthy();
    expect(researchInstructions).toContain("Research Agent");
    expect(researchInstructions).toContain("Never fabricate");
  });

  it("exposes the web fetch tool for reading sources", async () => {
    const tools = await researchAgent?.listTools();
    const toolIds = Object.keys(tools ?? {});
    expect(toolIds).toContain("web_fetch");
  });

  it("exports the runResearch runtime entry point", () => {
    expect(typeof runResearch).toBe("function");
  });
});