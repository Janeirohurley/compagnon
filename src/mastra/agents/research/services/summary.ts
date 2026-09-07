/**
 * Human-readable summary of a ResearchResult.
 *
 * Used by the research_request tool and by the plan executor so a research
 * task can be reported back in a compact, presentable form.
 */
import type { ResearchResult } from "../domain/types";

export function formatResearchSummary(result: ResearchResult): string {
  const sections: string[] = [];

  if (result.answer) sections.push(result.answer);
  if (result.executiveSummary) sections.push(result.executiveSummary);
  if (result.findings.length > 0) {
    sections.push(
      "Findings:\n" +
        result.findings.map((f) => `- [${f.confidence}] ${f.statement}`).join("\n"),
    );
  }
  if ((result.uncertainties ?? []).length > 0) {
    sections.push(
      "Uncertainties:\n" +
        (result.uncertainties ?? []).map((u) => `- ${u.description}`).join("\n"),
    );
  }
  if ((result.contradictions ?? []).length > 0) {
    sections.push(
      "Contradictions:\n" +
        (result.contradictions ?? [])
          .map((c) => `- ${c.description} (${c.resolved ? "resolved" : "unresolved"})`)
          .join("\n"),
    );
  }
  sections.push(
    `Sources (${result.sources.length}): ${result.sources.map((s) => s.url).join(", ")}`,
  );

  return sections.join("\n\n");
}