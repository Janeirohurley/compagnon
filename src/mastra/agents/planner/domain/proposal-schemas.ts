import { z } from "zod";
import { TaskPriority, TaskType } from "./enums";
import { planningQuestionSchema } from "./schemas";


const taskDraftSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),

  type: z.enum([
    TaskType.RESEARCH,
    TaskType.ANALYSIS,
    TaskType.IMPLEMENTATION,
    TaskType.CONFIGURATION,
    TaskType.MIGRATION,
    TaskType.TESTING,
    TaskType.VERIFICATION,
    TaskType.DOCUMENTATION,
  ]),

  priority: z.enum([
    TaskPriority.LOW,
    TaskPriority.MEDIUM,
    TaskPriority.HIGH,
    TaskPriority.CRITICAL,
  ]),

  resources: z.array(z.string().min(1)),
  expectedOutputs: z.array(z.string().min(1)),
  acceptanceCriteria: z.array(z.string().min(1)),
  suggestedAgent: z.string().min(1).optional(),
  risks: z.array(z.string().min(1)),
});

const readyProposalSchema = z.object({
  status: z.literal("ready"),

  objective: z.string().min(1),

  context: z.string().optional(),

  constraints: z.array(z.string().min(1)),

  tasks: z.array(taskDraftSchema).min(1),

  summary: z.string().min(1),
});

const clarificationProposalSchema = z.object({
  status: z.literal("needs_clarification"),
  summary: z.string().min(1),
  questions: z.array(planningQuestionSchema).min(1),
});

const blockedProposalSchema = z.object({
  status: z.literal("blocked"),
  summary: z.string().min(1),
  blockers: z.array(z.string().min(1)).min(1),
});

const invalidProposalSchema = z.object({
  status: z.literal("invalid"),
  summary: z.string().min(1),
  blockers: z.array(z.string().min(1)).min(1),
});

const outOfScopeProposalSchema = z.object({
  status: z.literal("out_of_scope"),
  summary: z.string().min(1),
  suggestedAgent: z.string().min(1).optional(),
});

export const plannerProposalSchema = z.discriminatedUnion("status", [
  readyProposalSchema,
  clarificationProposalSchema,
  blockedProposalSchema,
  invalidProposalSchema,
  outOfScopeProposalSchema,
]);

export const planTaskDraftSchema = taskDraftSchema;