import { memoryManager } from "./memory-manager";
import type { RememberInput, SemanticMemory } from "../domain/types";

/**
 * Preference access helpers.
 *
 * Preferences are ordinary semantic memories with a fixed convention:
 *   subject: the preference key (e.g. "documentation-backend")
 *   predicate: "prefers"
 *   value: the chosen value (e.g. "outline" | "notion")
 *
 * Reuses the existing storage/search/supersede machinery — no new storage.
 */

export async function getPreference(subject: string): Promise<string | null> {
  const results = await memoryManager.search({
    query: subject,
    scope: "global",
    minConfidence: 0.5,
    limit: 5,
    types: ["semantic"],
  });

  for (const result of results) {
    const data = result.data as SemanticMemory;
    if (data.status === "active" && data.predicate === "prefers") {
      return data.value;
    }
  }

  return null;
}

export async function setPreference(
  subject: string,
  value: string,
  sourceType: "user" | "conversation" | "tool" = "user",
): Promise<SemanticMemory> {
  const existing = await getPreference(subject);

  const rememberInput: RememberInput = {
    scope: "global",
    subject,
    predicate: "prefers",
    value,
    confidence: 0.95,
    source: { type: sourceType },
  };

  if (existing) {
    // Supersede the previous preference (marks the old one superseded).
    const results = await memoryManager.search({
      query: subject,
      scope: "global",
      minConfidence: 0.5,
      limit: 5,
      types: ["semantic"],
    });

    for (const result of results) {
      const data = result.data as SemanticMemory;
      if (
        data.status === "active" &&
        data.predicate === "prefers" &&
        data.value === existing
      ) {
        return memoryManager.supersedeMemory(data.id, rememberInput);
      }
    }
  }

  return memoryManager.remember(rememberInput);
}
