/**
 * Operations supported by the Plane Agent.
 */
export const PlaneOperation = {
  LIST_PROJECTS: "list_projects",
  GET_PROJECT: "get_project",
  LIST_WORK_ITEMS: "list_work_items",
  GET_WORK_ITEM: "get_work_item",
  CREATE_WORK_ITEM: "create_work_item",
  UPDATE_WORK_ITEM: "update_work_item",
  SEARCH_WORK_ITEMS: "search_work_items",
  LIST_STATES: "list_states",
  LIST_CYCLES: "list_cycles",
  LIST_MODULES: "list_modules",
  ADD_COMMENT: "add_comment",
  LIST_COMMENTS: "list_comments",
  ADVANCEMENT_REPORT: "advancement_report",
  DETECT_BLOCKAGES: "detect_blockages",
} as const;

export type PlaneOperation = (typeof PlaneOperation)[keyof typeof PlaneOperation];

/**
 * Work item states.
 */
export const WorkItemState = {
  BACKLOG: "backlog",
  TODO: "todo",
  IN_PROGRESS: "in_progress",
  DONE: "done",
  CANCELLED: "cancelled",
} as const;

export type WorkItemState = (typeof WorkItemState)[keyof typeof WorkItemState];

/**
 * Priority levels.
 */
export const Priority = {
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
} as const;

export type Priority = (typeof Priority)[keyof typeof Priority];

/**
 * Cycle status.
 */
export const CycleStatus = {
  ACTIVE: "active",
  UPCOMING: "upcoming",
  COMPLETED: "completed",
  DRAFT: "draft",
} as const;

export type CycleStatus = (typeof CycleStatus)[keyof typeof CycleStatus];

/**
 * Plane Agent result status.
 */
export const PlaneStatus = {
  SUCCESS: "success",
  PARTIAL: "partial",
  FAILED: "failed",
  BLOCKED: "blocked",
  NEEDS_CLARIFICATION: "needs_clarification",
} as const;

export type PlaneStatus = (typeof PlaneStatus)[keyof typeof PlaneStatus];
