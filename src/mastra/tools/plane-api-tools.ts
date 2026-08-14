import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { getPlaneConnection, planeNeedsConnectionResult, planeRequest } from '../connections/plane-provider';

const planeResultSchema = z.object({
  success: z.boolean(),
  status: z.number().optional(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  reason: z.string().optional(),
  provider: z.string().optional(),
  ui: z.unknown().optional(),
});

const connectionSchema = z.object({
  connectionId: z.string().optional().describe('Optional saved Plane connection id. Defaults to the enabled default Plane connection.'),
});

const querySchema = connectionSchema.extend({
  cursor: z.string().optional(),
  per_page: z.number().int().positive().optional(),
  expand: z.string().optional(),
  fields: z.string().optional(),
  order_by: z.string().optional(),
});

function qs(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value));
    }
  }

  const value = search.toString();
  return value ? `?${value}` : '';
}

async function workspacePath(path: string, connectionId?: string) {
  const plane = await getPlaneConnection(connectionId);
  if (!plane) return null;
  return `/api/v1/workspaces/${encodeURIComponent(plane.workspaceSlug)}${path}`;
}

async function projectPath(projectId: string, path: string, connectionId?: string) {
  return workspacePath(`/projects/${encodeURIComponent(projectId)}${path}`, connectionId);
}

export const planeListProjectsTool = createTool({
  id: 'plane_list_projects',
  description: 'List Plane projects from a saved Plane connection. Returns needs_connection UI metadata if not configured.',
  inputSchema: querySchema,
  outputSchema: planeResultSchema,
  execute: async ({ connectionId, ...input }) => {
    const path = await workspacePath(`/projects/${qs(input)}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeListStatesTool = createTool({
  id: 'plane_list_states',
  description: 'List Plane states for a project from a saved Plane connection.',
  inputSchema: querySchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, connectionId, ...query }) => {
    const path = await projectPath(projectId, `/states/${qs(query)}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeListIssuesTool = createTool({
  id: 'plane_list_issues',
  description: 'List Plane work items for a project from a saved Plane connection.',
  inputSchema: querySchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, connectionId, ...query }) => {
    const path = await projectPath(projectId, `/work-items/${qs(query)}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeGetIssueTool = createTool({
  id: 'plane_get_issue',
  description: 'Get one Plane work item by resource UUID from a saved Plane connection.',
  inputSchema: querySchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
    issueId: z.string().describe('Plane work item resource UUID.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, issueId, connectionId, ...query }) => {
    const path = await projectPath(projectId, `/work-items/${encodeURIComponent(issueId)}/${qs(query)}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeSearchIssuesTool = createTool({
  id: 'plane_search_issues',
  description: 'Search Plane work items in a workspace from a saved Plane connection.',
  inputSchema: connectionSchema.extend({
    search: z.string().describe('Search text.'),
    limit: z.number().int().positive().optional(),
    projectId: z.string().optional().describe('Optional Plane project UUID.'),
    workspace_search: z.string().optional(),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ connectionId, projectId, ...query }) => {
    const path = await workspacePath(`/work-items/search/${qs({ ...query, project_id: projectId })}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeCreateIssueTool = createTool({
  id: 'plane_create_issue',
  description: 'Create a Plane work item from a saved Plane connection. State-changing operation; requires approval.',
  requireApproval: true,
  inputSchema: connectionSchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
    name: z.string().describe('Work item title.'),
    description_html: z.string().optional(),
    priority: z.string().optional(),
    state: z.string().optional().describe('Plane state UUID.'),
    assignees: z.array(z.string()).optional(),
    labels: z.array(z.string()).optional(),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, connectionId, ...body }) => {
    const path = await projectPath(projectId, '/work-items/', connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('POST', path, body, connectionId);
  },
});

export const planeUpdateIssueTool = createTool({
  id: 'plane_update_issue',
  description: 'Update a Plane work item from a saved Plane connection. State-changing operation; requires approval.',
  requireApproval: true,
  inputSchema: connectionSchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
    issueId: z.string().describe('Plane work item resource UUID.'),
    fields: z.record(z.string(), z.unknown()).describe('Plane PATCH body fields.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, issueId, connectionId, fields }) => {
    const path = await projectPath(projectId, `/work-items/${encodeURIComponent(issueId)}/`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('PATCH', path, fields, connectionId);
  },
});

export const planeListIssueCommentsTool = createTool({
  id: 'plane_list_issue_comments',
  description: 'List comments for a Plane work item from a saved Plane connection.',
  inputSchema: querySchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
    issueId: z.string().describe('Plane work item resource UUID.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, issueId, connectionId, ...query }) => {
    const path = await projectPath(projectId, `/work-items/${encodeURIComponent(issueId)}/comments/${qs(query)}`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('GET', path, undefined, connectionId);
  },
});

export const planeAddIssueCommentTool = createTool({
  id: 'plane_add_issue_comment',
  description: 'Add a comment to a Plane work item from a saved Plane connection. State-changing operation; requires approval.',
  requireApproval: true,
  inputSchema: connectionSchema.extend({
    projectId: z.string().describe('Plane project UUID.'),
    issueId: z.string().describe('Plane work item resource UUID.'),
    comment_html: z.string().describe('Comment HTML content.'),
  }),
  outputSchema: planeResultSchema,
  execute: async ({ projectId, issueId, connectionId, comment_html }) => {
    const path = await projectPath(projectId, `/work-items/${encodeURIComponent(issueId)}/comments/`, connectionId);
    if (!path) return planeNeedsConnectionResult();
    return planeRequest('POST', path, { comment_html }, connectionId);
  },
});
