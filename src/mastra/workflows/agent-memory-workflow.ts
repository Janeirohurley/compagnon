// Agent-Memory Workflow - Native Mastra workflow
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { memoryManager } from "../agents/memory/services/memory-manager";
import { companionAgent } from "../agents/companion/agent";
import { z } from "zod";

// Step 1: Retrieve context from Memory Agent
const retrieveContextStep = createStep({
  id: "retrieve-context",
  description: "Retrieves relevant memories, procedures, decisions, and episodes from the Memory Agent before executing the main task.",
  inputSchema: z.object({
    task: z.string(),
    project: z.string().optional(),
    repository: z.string().optional(),
  }),
  outputSchema: z.object({
    task: z.string(),
    context: z.string(),
    memoriesFound: z.number(),
  }),
  execute: async ({ inputData }) => {
    // Use memory manager directly instead of agent
    const results = await memoryManager.search({
      query: inputData.task,
      project: inputData.project,
      repository: inputData.repository,
      types: ["semantic", "episode", "procedure", "decision"],
      limit: 10,
    });

    if (results.length === 0) {
      return {
        task: inputData.task,
        context: "No relevant context found in memory.",
        memoriesFound: 0,
      };
    }

    // Format results as context
    const contextParts = results.map((r) => {
      const data = r.data as unknown as Record<string, unknown>;
      switch (r.type) {
        case "semantic":
          return `Fact: ${data.subject} ${data.predicate} ${data.value}`;
        case "episode":
          return `Episode: ${data.trigger} - ${data.outcome}`;
        case "procedure":
          return `Procedure: ${data.name} - ${data.purpose}`;
        case "decision":
          return `Decision: ${data.title} - ${data.decision}`;
        default:
          return String(data);
      }
    });

    return {
      task: inputData.task,
      context: contextParts.join("\n\n"),
      memoriesFound: results.length,
    };
  },
});

// Step 2: Execute main task with retrieved context
const executeTaskStep = createStep({
  id: "execute-task",
  description: "Executes the main task using the Companion Agent with context retrieved from Memory Agent as background knowledge.",
  inputSchema: z.object({
    task: z.string(),
    context: z.string(),
    memoriesFound: z.number(),
  }),
  outputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    const contextInfo = inputData.memoriesFound > 0
      ? `Relevant context from memory:\n${inputData.context}\n\n`
      : "";

    const prompt = `${contextInfo}Task: ${inputData.task}`;

    try {
      // companionAgent.generate() returns a Response object
      const response = await companionAgent.generate(prompt);

      // Get text from response
      let text = "Task completed but no result returned.";
      const resp = response as any;
      if (resp) {
        if (typeof resp.text === 'string') {
          text = resp.text;
        } else if (typeof resp === 'string') {
          text = resp;
        } else if (typeof resp.text === 'function') {
          text = await resp.text() || text;
        } else {
          text = String(resp.text || JSON.stringify(resp));
        }
      }

      return {
        task: inputData.task,
        context: inputData.context,
        result: text,
        success: true,
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(JSON.stringify(error));
      const errorMsg = `${errorObj.message}\n${errorObj.stack || ''}`;
      return {
        task: inputData.task,
        context: inputData.context,
        result: `Error: ${errorMsg}`,
        success: false,
      };
    }
  },
});

// Step 3: Store new information to Memory Agent
const storeMemoryStep = createStep({
  id: "store-memory",
  description: "Analyzes the task result and stores any new facts, procedures, or decisions back to the Memory Agent for future retrieval.",
  inputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
  }),
  outputSchema: z.object({
    stored: z.boolean(),
    memoryId: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Always pass through the data
    const baseResult = {
      task: inputData.task,
      context: inputData.context,
      result: inputData.result,
      success: inputData.success,
    };

    if (!inputData.success) {
      return { ...baseResult, stored: false };
    }

    // Extract key facts from the result and store them
    const resultText = inputData.result || "";
    const taskText = inputData.task || "";

    // Simple extraction: store the task outcome as an episode
    try {
      await memoryManager.recordEpisode({
        task: taskText.substring(0, 100),
        trigger: taskText.substring(0, 200),
        observations: [resultText.substring(0, 500)],
        actions: [],
        outcome: resultText.substring(0, 500),
        success: true,
      });
    } catch (e) {
      console.error("Failed to store memory:", e);
      return { stored: false };
    }

    return {
      ...baseResult,
      stored: true,
      memoryId: crypto.randomUUID(),
    };
  },
});

// Create the workflow - chain steps with .then()
export const agentMemoryWorkflow = createWorkflow({
  id: "agent-memory-workflow",
  description: "Memory-first workflow: retrieves context from Memory Agent, executes task with Companion Agent, then stores new knowledge back to Memory Agent. This ensures every task benefits from existing knowledge and contributes new learnings.",
  inputSchema: z.object({
    task: z.string(),
    project: z.string().optional(),
    repository: z.string().optional(),
  }),
  outputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
    stored: z.boolean(),
    memoryId: z.string().optional(),
  }),
})
  .then(retrieveContextStep)
  .then(executeTaskStep)
  .then(storeMemoryStep)
  .commit();

// Export step IDs
export const stepIds = {
  RETRIEVE_CONTEXT: "retrieve-context",
  EXECUTE_TASK: "execute-task",
  STORE_MEMORY: "store-memory",
};
