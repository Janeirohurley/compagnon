// Memory Hooks Tool - Enables automatic memory retrieval and extraction
import { executeWithMemoryHooks, executeMemoryTask, retrieveRelevantMemories, extractTaskMemories, extractFactsFromText } from "../agents/memory";

export const memoryHooksTool = {
  name: "memory_hooks",
  description: "Manage memory hooks - retrieve relevant memories before tasks, extract facts after, or execute tasks with automatic memory management.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["retrieve", "extract", "execute", "execute_memory_task"],
        description: "The hook action to perform"
      },
      task: { type: "string", description: "Task description for retrieval or execution" },
      fn: { type: "string", description: "Function name to execute (for execute action)" },
      project: { type: "string", description: "Project scope" },
      repository: { type: "string", description: "Repository scope" },
      scope: { type: "string", enum: ["global", "project", "repository"] },
      scopeId: { type: "string" },
      text: { type: "string", description: "Text to extract facts from" },
    },
    required: ["action"]
  },
  execute: async (input: {
    action: "retrieve" | "extract" | "execute" | "execute_memory_task";
    task?: string;
    project?: string;
    repository?: string;
    scope?: "global" | "project" | "repository";
    scopeId?: string;
    text?: string;
  }) => {
    switch (input.action) {
      case "retrieve":
        if (!input.task) return { success: false, error: "task required" };
        await retrieveRelevantMemories({
          task: input.task,
          project: input.project,
          repository: input.repository,
        });
        return { success: true, action: "retrieve" };

      case "extract":
        if (!input.text) return { success: false, error: "text required" };
        await extractFactsFromText(
          input.text,
          input.scope || "global",
          input.scopeId,
          "conversation"
        );
        return { success: true, action: "extract" };

      case "execute_memory_task":
        if (!input.task) return { success: false, error: "task required" };
        const result = await executeMemoryTask(
          input.task,
          { project: input.project, repository: input.repository }
        );
        return { success: true, result };

      default:
        return { success: false, error: "Unknown action" };
    }
  },
};
