// Agent-Memory Workflow - memory-first workflow over the unified Mastra memory.
// Retrieves real context (semantic recall + working memory), executes the task
// through generateWithMemory, then persists a concise fact when it succeeded.
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { generateWithMemory } from "../agents/companion/agent";
import { resolveMemoryIds, retrieveContext, sanitizeForMemory } from "../agents/companion/memory-context";
import { memoryStoreTool } from "../agents/memory/tools";
import { z } from "zod";

const workflowInputSchema = z.object({
  task: z.string(),
  project: z.string().optional(),
  repository: z.string().optional(),
  resourceId: z.string().optional(),
});

// Step 1: Retrieve context from the unified memory
const retrieveContextStep = createStep({
  id: "retrieve-context",
  description: "Retrieves relevant semantic recall and working memory (facts, preferences, decisions, procedures) for the task.",
  inputSchema: workflowInputSchema,
  outputSchema: workflowInputSchema.extend({
    context: z.string(),
    memoriesFound: z.number(),
  }),
  execute: async ({ inputData }) => {
    const ids = resolveMemoryIds({ resourceId: inputData.resourceId ?? inputData.project });
    const context = await retrieveContext(inputData.task, ids);
    return {
      ...inputData,
      context,
      memoriesFound: (context.match(/^- /gm) || []).length,
    };
  },
});

// Step 2: Execute main task with retrieved context
const executeTaskStep = createStep({
  id: "execute-task",
  description: "Executes the main task using the Companion Agent with the unified memory context injected into the prompt.",
  inputSchema: workflowInputSchema.extend({
    context: z.string(),
    memoriesFound: z.number(),
  }),
  outputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
    resourceId: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    const contextInfo = inputData.context
      ? `Relevant context from memory:\n${inputData.context}\n\n`
      : "";

    const prompt = `${contextInfo}Task: ${inputData.task}`;

    try {
      const response = await generateWithMemory(prompt, {
        resourceId: inputData.resourceId ?? inputData.project,
      });
      return {
        task: inputData.task,
        context: inputData.context,
        result: response.text ?? "",
        success: true,
        resourceId: inputData.resourceId ?? inputData.project,
      };
    } catch (error) {
      const errorObj = error instanceof Error ? error : new Error(JSON.stringify(error));
      const errorMsg = `${errorObj.message}\n${errorObj.stack || ''}`;
      return {
        task: inputData.task,
        context: inputData.context,
        result: `Error: ${errorMsg}`,
        success: false,
        resourceId: inputData.resourceId ?? inputData.project,
      };
    }
  },
});

// Step 3: Store new information to the unified memory
const storeMemoryStep = createStep({
  id: "store-memory",
  description: "When the task succeeded, persists a concise durable fact (sanitized) into the working memory.",
  inputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
    resourceId: z.string().optional(),
  }),
  outputSchema: z.object({
    stored: z.boolean(),
  }),
  execute: async ({ inputData }) => {
    if (!inputData.success) {
      return { stored: false };
    }

    const content = `résultat: ${inputData.result.substring(0, 500)}`;
    if (sanitizeForMemory(content) === null) {
      return { stored: false };
    }

    try {
      await memoryStoreTool.execute({
        label: "faits",
        subject: inputData.task.substring(0, 100),
        content,
        resourceId: inputData.resourceId,
      });
      return { stored: true };
    } catch (e) {
      console.error("Failed to store memory:", e);
      return { stored: false };
    }
  },
});

// Create the workflow - chain steps with .then()
export const agentMemoryWorkflow = createWorkflow({
  id: "agent-memory-workflow",
  description: "Memory-first workflow: retrieves context from the unified memory (semantic recall + working memory), executes the task with the Companion Agent, then stores new knowledge back into the working memory.",
  inputSchema: workflowInputSchema,
  outputSchema: z.object({
    task: z.string(),
    context: z.string(),
    result: z.string(),
    success: z.boolean(),
    stored: z.boolean(),
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