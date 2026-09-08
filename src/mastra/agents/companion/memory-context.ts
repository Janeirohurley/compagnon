// Memory context helpers: real, injectable retrieval isolated by resource/thread.
// SEC-001: anything that will be written to memory must pass through
// `sanitizeForMemory` first (secret patterns rejected).
import { getCompanionMemory } from "./memory";

export interface MemoryIds {
  resourceId: string;
  threadId?: string;
}

/**
 * Resolve the resource/thread ids for a memory access.
 * Priority: `resourceId` > `userId`, last resort `anonymous` (documented default).
 */
export function resolveMemoryIds(meta?: Record<string, unknown>): MemoryIds {
  const resourceId =
    typeof meta?.resourceId === "string"
      ? meta.resourceId
      : typeof meta?.userId === "string"
        ? meta.userId
        : "anonymous";
  const threadId = typeof meta?.threadId === "string" ? meta.threadId : undefined;
  return { resourceId, threadId };
}

const SECRET_PATTERN =
  /(sk-[A-Za-z0-9]{16,}|gh[pous]_[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|AKIA[A-Z0-9]{16}|-----BEGIN)/;

/** Returns the input unchanged when it is safe for memory, otherwise null. */
export function sanitizeForMemory(text: string): string | null {
  return SECRET_PATTERN.test(text) ? null : text;
}

function messageContentToText(content: unknown): string {
  if (typeof content === "string") return content;
  if (content == null) return "";
  return JSON.stringify(content);
}

/**
 * Retrieves the relevant context (semantic recall + working memory) for a task
 * and returns it as a compact markdown section, or "" when nothing matches.
 */
export async function retrieveContext(task: string, ids: MemoryIds): Promise<string> {
  const memory = getCompanionMemory();
  // Working memory and recall are resource-scoped (scope: "resource"); a stable
  // thread id is still required by the API, so the resource id doubles as the
  // canonical thread id when no explicit thread exists yet.
  const contextThreadId = ids.threadId || ids.resourceId;
  const parts: string[] = [];

  try {
    const { messages } = await memory.recall({
      threadId: contextThreadId,
      resourceId: ids.resourceId,
      vectorSearchString: task,
      perPage: 4,
    });
    for (const message of messages) {
      parts.push(`- ${message.role}: ${messageContentToText(message.content).substring(0, 500)}`);
    }
  } catch {
    // Retrieval must never break generation; an empty context is a valid result.
  }

  try {
    const workingMemory = await memory.getWorkingMemory({
      threadId: contextThreadId,
      resourceId: ids.resourceId,
    });
    if (workingMemory) {
      parts.push(workingMemory);
    }
  } catch {
    // Same as above.
  }

  if (parts.length === 0) return "";
  return `## Contexte mémoire\n${parts.join("\n\n")}`;
}