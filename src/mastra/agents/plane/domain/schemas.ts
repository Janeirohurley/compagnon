import { z } from "zod";
import { PlaneOperation, PlaneStatus } from "./enums";

export const planeOperationSchema = z.enum([
  PlaneOperation.LIST_PROJECTS,
  PlaneOperation.GET_PROJECT,
  PlaneOperation.LIST_WORK_ITEMS,
  PlaneOperation.GET_WORK_ITEM,
  PlaneOperation.CREATE_WORK_ITEM,
  PlaneOperation.UPDATE_WORK_ITEM,
  PlaneOperation.SEARCH_WORK_ITEMS,
  PlaneOperation.LIST_STATES,
  PlaneOperation.LIST_CYCLES,
  PlaneOperation.LIST_MODULES,
  PlaneOperation.ADD_COMMENT,
  PlaneOperation.LIST_COMMENTS,
  PlaneOperation.ADVANCEMENT_REPORT,
  PlaneOperation.DETECT_BLOCKAGES,
]);

export const planeStatusSchema = z.enum([
  PlaneStatus.SUCCESS,
  PlaneStatus.PARTIAL,
  PlaneStatus.FAILED,
  PlaneStatus.BLOCKED,
  PlaneStatus.NEEDS_CLARIFICATION,
]);

export const planeTaskInputSchema = z.object({
  operation: planeOperationSchema,
  project: z.string().optional(),
  projectId: z.string().optional(),
  parameters: z.record(z.string(), z.unknown()).optional(),
  context: z.string().optional(),
});

export const planeTaskResultSchema = z.object({
  status: planeStatusSchema,
  operation: planeOperationSchema,
  result: z.unknown().optional(),
  summary: z.string(),
  errors: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});
