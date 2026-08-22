import type { OutlineOperation, OutlineStatus } from "./enums";

/**
 * Document summary.
 */
export interface DocumentSummary {
  id: string;
  title: string;
  url?: string;
  collectionId?: string;
  collectionName?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Collection summary.
 */
export interface CollectionSummary {
  id: string;
  name: string;
  description?: string;
  documentCount: number;
  createdAt: string;
}

/**
 * Search result.
 */
export interface SearchResult {
  id: string;
  title: string;
  snippet?: string;
  url?: string;
  collectionId?: string;
}

/**
 * Input for the Outline Agent.
 */
export interface OutlineAgentInput {
  operation: OutlineOperation;
  parameters?: {
    query?: string;
    documentId?: string;
    collectionId?: string;
    title?: string;
    content?: string;
    markdown?: string;
    parentDocumentId?: string;
    publishFrom?: "memory";
    memoryType?: "decision" | "procedure" | "episode" | "semantic";
    memoryId?: string;
    tags?: string[];
  };
  context?: string;
}

/**
 * Result of an Outline Agent operation.
 */
export interface OutlineAgentResult {
  status: OutlineStatus;
  operation: OutlineOperation;
  result?: unknown;
  documents?: DocumentSummary[];
  collections?: CollectionSummary[];
  summary: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
}
