import type { NotionOperation, NotionStatus } from "./enums";

/**
 * Page summary returned by a search or read operation.
 */
export interface PageSummary {
  id: string;
  title: string;
  url?: string;
  path?: string;
  parentId?: string;
  lastEditedAt?: string;
}

/**
 * Database / data source summary.
 */
export interface DatabaseSummary {
  id: string;
  name: string;
  url?: string;
  dataSourceId?: string;
  propertyCount?: number;
}

/**
 * Search result.
 */
export interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  path?: string;
  url?: string;
}

/**
 * Input for the Notion Agent.
 */
export interface NotionAgentInput {
  operation: NotionOperation;
  parameters?: {
    query?: string;
    pageId?: string;
    databaseId?: string;
    dataSourceId?: string;
    title?: string;
    content?: string;
    markdown?: string;
    parentPageId?: string;
    properties?: Record<string, unknown>;
    filters?: Record<string, unknown>;
  };
  context?: string;
}

/**
 * Result of a Notion Agent operation.
 */
export interface NotionAgentResult {
  status: NotionStatus;
  operation: NotionOperation;
  result?: unknown;
  pages?: PageSummary[];
  databases?: DatabaseSummary[];
  summary: string;
  errors?: { code: string; message: string }[];
  warnings?: string[];
  suggestions?: string[];
}