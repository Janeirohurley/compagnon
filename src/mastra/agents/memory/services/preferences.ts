// Preference access helpers backed by the unified working memory.
//
// Preferences live in the `# Préférences` block of the resource-scoped working
// memory as `- <subject>: <value>` lines (e.g. `- documentation-backend: outline`).
// Updating a preference overwrites its single source of truth — no duplicate rows,
// no supersede lifecycle (the working memory is the canonical state).
import { getCompanionMemory } from "../../companion/memory";
import { resolveMemoryIds, sanitizeForMemory } from "../../companion/memory-context";

const PREFERENCES_HEADING = "# Préférences";
const DEFAULT_RESOURCE: Record<string, unknown> = { resourceId: "anonymous" };

export interface Preference {
  subject: string;
  predicate: "prefers";
  value: string;
  sourceType: "user" | "conversation" | "tool";
}

function parsePreferenceLines(workingMemory: string): Map<string, string> {
  const preferences = new Map<string, string>();
  const lines = workingMemory.split("\n");

  let inBlock = false;
  for (const line of lines) {
    if (line === PREFERENCES_HEADING) {
      inBlock = true;
      continue;
    }
    if (inBlock && line.startsWith("#")) break;
    if (!inBlock) continue;

    const match = line.match(/^-\s*([^:]+):\s*(.+)$/);
    if (match) preferences.set(match[1].trim(), match[2].trim());
  }

  return preferences;
}

export async function getPreference(subject: string): Promise<string | null> {
  const ids = resolveMemoryIds(DEFAULT_RESOURCE);
  const memory = getCompanionMemory();
  const workingMemory = await memory.getWorkingMemory({
    threadId: ids.resourceId,
    resourceId: ids.resourceId,
  });

  if (!workingMemory) return null;
  return parsePreferenceLines(workingMemory).get(subject) ?? null;
}

export async function setPreference(
  subject: string,
  value: string,
  sourceType: "user" | "conversation" | "tool" = "user",
): Promise<Preference> {
  if (sanitizeForMemory(`${subject}: ${value}`) === null) {
    throw new Error("preference rejected: secret pattern detected");
  }

  const ids = resolveMemoryIds(DEFAULT_RESOURCE);
  const memory = getCompanionMemory();
  const contextThreadId = ids.threadId || ids.resourceId;

  let workingMemory =
    (await memory.getWorkingMemory({ threadId: contextThreadId, resourceId: ids.resourceId })) ?? "";

  const lines = workingMemory.length ? workingMemory.split("\n") : [];
  const idx = lines.findIndex((line) => line === PREFERENCES_HEADING);
  const line = `- ${subject}: ${value}`;

  if (idx === -1) {
    const block = `${PREFERENCES_HEADING}\n${line}`;
    workingMemory = lines.length ? `${workingMemory}\n\n${block}` : block;
  } else {
    const filtered = lines.filter((l) => l !== line && !l.startsWith(`- ${subject}:`));
    let insertAt = idx + 1;
    while (
      insertAt < filtered.length &&
      filtered[insertAt].trim() &&
      !filtered[insertAt].startsWith("#")
    ) {
      insertAt++;
    }
    filtered.splice(insertAt, 0, line);
    workingMemory = filtered.join("\n");
  }

  await memory.updateWorkingMemory({
    threadId: contextThreadId,
    resourceId: ids.resourceId,
    workingMemory,
  });

  return { subject, predicate: "prefers", value, sourceType };
}