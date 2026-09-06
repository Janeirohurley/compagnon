/**
 * Plane Native Module
 * 
 * Production-grade integration with Plane for Companon.
 * 
 * Architecture:
 * 
 *   Agent
 *     ↓
 *   Mastra Tool
 *     ↓
 *   Plane Service
 *     ↓
 *   Plane Client
 *     ↓
 *   Plane REST API
 * 
 * For usage:
 * 
 * ```typescript
 * import { PlaneConfig, PlaneServiceImpl, planeTools } from './plane';
 * 
 * // Initialize configuration
 * const config = new PlaneConfig({
 *   baseUrl: process.env.PLANE_BASE_URL,
 *   apiKey: process.env.PLANE_API_KEY,
 * });
 * 
 * // Get client and create service
 * const client = config.getClient();
 * const service = new PlaneServiceImpl(client, config);
 * 
 * // Use in an agent
 * const agent = createAgent({
 *   tools: [planeTools.listWorkItemsTool, planeTools.createWorkItemTool],
 * });
 * ```
 */

// Client exports
export type { PlaneClient, PlaneClientConfig, PlaneRequestOptions } from './client/plane-client';
export { createPlaneClient } from './client/plane-client';

export {
  PlaneError,
  PlaneAuthenticationError,
  PlaneAuthorizationError,
  PlaneNotFoundError,
  PlaneValidationError,
  PlaneRateLimitError,
  PlaneServerError,
  PlaneNetworkError,
  PlaneTimeoutError,
  createPlaneError,
} from './client/plane-errors';

export type { PaginationParams, PaginatedResponse, PlanePaginationConfig } from './client/plane-pagination';
export { buildPaginationParams, parsePaginatedResponse, Paginator } from './client/plane-pagination';

// Config exports
export type { PlaneConnectionConfig, PlaneConfigOptions } from './config/plane-config';
export {
  PlaneConfig,
  PLANE_ENV_KEYS,
  getPlaneConfigFromEnv,
  createPlaneConfig,
  getPlaneConfig,
  initializePlaneConfig,
} from './config/plane-config';

// Domain exports
export type {
  Workspace,
  WorkItem,
  Comment,
  Project,
  Cycle,
  Module,
  Member,
  Relation,
} from './domain/types';

export type {
  PlaneService,
  ListWorkspacesParams,
  ListWorkItemsParams,
  ListCommentsParams,
  ListProjectsParams,
  ListCyclesParams,
  ListModulesParams,
  ListMembersParams,
  ListRelationsParams,
} from './domain/contracts';

export { PlaneServiceImpl } from './services/plane-services';

// Tools exports
export {
  planeTools,
  getWorkspaceTool,
  listWorkspacesTool,
  getWorkItemTool,
  createWorkItemTool,
  updateWorkItemTool,
  deleteWorkItemTool,
  listWorkItemsTool,
  createCommentTool,
  listCommentsTool,
  getProjectTool,
  listProjectsTool,
  listCyclesTool,
  listModulesTool,
  listMembersTool,
  createRelationTool,
  listRelationsTool,
} from './tools/plane-tools';
