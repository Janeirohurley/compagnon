import { z } from "zod";
import { OutlineOperation, OutlineStatus } from "./enums";

export const outlineOperationSchema = z.enum([
  OutlineOperation.SEARCH,
  OutlineOperation.READ,
  OutlineOperation.CREATE,
  OutlineOperation.UPDATE,
  OutlineOperation.DELETE,
  OutlineOperation.LIST_DOCUMENTS,
  OutlineOperation.LIST_COLLECTIONS,
  OutlineOperation.PUBLISH_FROM_MEMORY,
  OutlineOperation.GENERATE_SUMMARY,
]);

export const outlineStatusSchema = z.enum([
  OutlineStatus.SUCCESS,
  OutlineStatus.PARTIAL,
  OutlineStatus.FAILED,
  OutlineStatus.BLOCKED,
  OutlineStatus.NEEDS_CLARIFICATION,
]);

export const outlineTaskInputSchema = z.object({
  operation: outlineOperationSchema,
  parameters: z.record(z.string(), z.unknown()).optional(),
  context: z.string().optional(),
});

export const outlineTaskResultSchema = z.object({
  status: outlineStatusSchema,
  operation: outlineOperationSchema,
  result: z.unknown().optional(),
  summary: z.string(),
  errors: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});
