import { memoryManager } from "../services/memory-manager";
import { rememberSchema, type RememberInput } from "../domain/schemas/remember";

export const memoryRememberTool = {
  name: "memory_remember",
  description: "Store important information that should be remembered. Use for facts, decisions, project context, and durable knowledge. Auto-scopes to project/repository if provided.",
  inputSchema: rememberSchema,
  execute: async (input: RememberInput) => {
    let scope: "global" | "project" | "repository" = "global";
    let scopeId: string | undefined;

    if (input.repository) {
      scope = "repository";
      scopeId = input.repository;
    } else if (input.project) {
      scope = "project";
      scopeId = input.project;
    }

    const memory = await memoryManager.remember({
      scope,
      scopeId,
      subject: input.subject,
      predicate: input.predicate,
      value: input.value,
      confidence: input.confidence,
      source: { type: input.sourceType },
    });
    return { success: true, memory, scope, scopeId };
  },
};
