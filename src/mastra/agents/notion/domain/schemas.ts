import { z } from "zod";
import { NotionOperation, NotionStatus, NotionErrorCode } from "./enums";

export const notionOperationSchema = z.enum([
  NotionOperation.SEARCH,
  NotionOperation.READ,
  NotionOperation.CREATE,
  NotionOperation.UPDATE,
  NotionOperation.DELETE,
  NotionOperation.ARCHIVE,
  NotionOperation.LIST,
  NotionOperation.QUERY_DATABASE,
  NotionOperation.CREATE_DATABASE_ENTRY,
  NotionOperation.MOVE,
  NotionOperation.CONNECT,
  NotionOperation.GENERATE_SUMMARY,
]);

export const notionStatusSchema = z.enum([
  NotionStatus.SUCCESS,
  NotionStatus.PARTIAL,
  NotionStatus.FAILED,
  NotionStatus.BLOCKED,
  NotionStatus.NEEDS_CLARIFICATION,
]);

export const notionErrorCodeSchema = z.enum([
  NotionErrorCode.NOT_CONNECTED,
  NotionErrorCode.PERMISSION_DENIED,
  NotionErrorCode.RESOURCE_NOT_FOUND,
  NotionErrorCode.RATE_LIMITED,
  NotionErrorCode.MCP_UNAVAILABLE,
  NotionErrorCode.OPERATION_FAILED,
]);

export const notionTaskInputSchema = z.object({
  operation: notionOperationSchema,
  parameters: z.record(z.string(), z.unknown()).optional(),
  context: z.string().optional(),
});

export const notionTaskResultSchema = z.object({
  status: notionStatusSchema,
  operation: notionOperationSchema,
  result: z.unknown().optional(),
  summary: z.string(),
  errors: z
    .array(z.object({ code: notionErrorCodeSchema, message: z.string() }))
    .optional(),
  warnings: z.array(z.string()).optional(),
  suggestions: z.array(z.string()).optional(),
});