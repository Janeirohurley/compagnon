/**
 * Plane Mastra Tools
 * 
 * Agent-facing tools for Plane operations.
 * These tools provide the interface between agents and the Plane service layer.
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { PlaneConfig } from '../config/plane-config';
import { PlaneServiceImpl } from '../services/plane-services';
import type { PlaneService } from '../domain/contracts';

// Helper to get the Plane service
const getPlaneService = (): PlaneService => {
  const config = new PlaneConfig({
    baseUrl: process.env.PLANE_BASE_URL || 'https://api.plane.so/',
    apiKey: process.env.PLANE_API_KEY,
    workspaceSlug: process.env.PLANE_WORKSPACE_SLUG,
  });
  const client = config.getClient();
  return new PlaneServiceImpl(client, config);
};

// Workspace Tools
export const getWorkspaceTool = createTool({
  id: 'plane_get_workspace',
  description: 'Get a Plane workspace by ID to establish the correct execution context before project-aware operations.',
  inputSchema: z.object({
    id: z.string().describe('The ID of the workspace to retrieve'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string().optional(),
    description: z.string().optional(),
    status: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }),
  execute: async (context) => {
    const service = getPlaneService();
    return service.getWorkspace(context.id);
  },
});

export const listWorkspacesTool = createTool({
  id: 'plane_list_workspaces',
  description: 'List Plane workspaces with optional search and pagination so the agent can select the correct workspace before mutating data.',
  inputSchema: z.object({
    search: z.string().optional().describe('Search by workspace name or slug'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().optional(),
      description: z.string().optional(),
      status: z.string().optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
    reason: z.string().optional(),
  }),
  execute: async (context) => {
    const workspaceHint = context.search || process.env.PLANE_WORKSPACE_SLUG;

    if (!workspaceHint) {
      return {
        items: [],
        nextCursor: undefined,
        hasMore: false,
        total: 0,
        reason: 'Plane does not expose a global workspace listing endpoint. Provide a workspace slug or workspace hint explicitly before listing projects.',
      };
    }

    const service = getPlaneService();
    const result = await service.listWorkspaces({
      search: workspaceHint,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });

    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Work Item Tools
export const getWorkItemTool = createTool({
  id: 'plane_get_work_item',
  description: 'Get a work item by ID from Plane',
  inputSchema: z.object({
    id: z.string().describe('The ID of the work item to retrieve'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.string(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    projectId: z.string(),
    estimate: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    completedAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    labels: z.array(z.string()).optional(),
  }),
  execute: async (context) => {
    const service = getPlaneService();
    const workItem = await service.getWorkItem(context.id);
    return workItem;
  },
});

export const createWorkItemTool = createTool({
  id: 'plane_create_work_item',
  description: 'Create a new work item in Plane',
  inputSchema: z.object({
    name: z.string().describe('The name/title of the work item'),
    description: z.string().optional().describe('Detailed description'),
    projectId: z.string().describe('The project ID to create the work item in'),
    status: z.string().optional().describe('Initial status'),
    priority: z.string().optional().describe('Priority level'),
    assigneeId: z.string().optional().describe('ID of the assignee'),
    estimate: z.number().optional().describe('Time estimate'),
    startDate: z.string().optional().describe('Start date (ISO format)'),
    dueDate: z.string().optional().describe('Due date (ISO format)'),
    labels: z.array(z.string()).optional().describe('Labels for the work item'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.string(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    projectId: z.string(),
    estimate: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    completedAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    labels: z.array(z.string()).optional(),
  }),
  execute: async (context) => {
    const service = getPlaneService();
    const workItem = await service.createWorkItem({
      name: context.name,
      description: context.description,
      projectId: context.projectId,
      status: context.status,
      priority: context.priority,
      assigneeId: context.assigneeId,
      estimate: context.estimate,
      startDate: context.startDate,
      dueDate: context.dueDate,
      labels: context.labels,
    });
    return workItem;
  },
});

export const updateWorkItemTool = createTool({
  id: 'plane_update_work_item',
  description: 'Update an existing work item in Plane',
  inputSchema: z.object({
    id: z.string().describe('The ID of the work item to update'),
    name: z.string().optional().describe('Updated name/title'),
    description: z.string().optional().describe('Updated description'),
    status: z.string().optional().describe('Updated status'),
    priority: z.string().optional().describe('Updated priority'),
    assigneeId: z.string().optional().describe('Updated assignee ID'),
    estimate: z.number().optional().describe('Updated time estimate'),
    startDate: z.string().optional().describe('Updated start date'),
    dueDate: z.string().optional().describe('Updated due date'),
    labels: z.array(z.string()).optional().describe('Updated labels'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.string(),
    priority: z.string().optional(),
    assigneeId: z.string().optional(),
    projectId: z.string(),
    estimate: z.number().optional(),
    startDate: z.string().optional(),
    dueDate: z.string().optional(),
    completedAt: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    labels: z.array(z.string()).optional(),
  }),
  execute: async (context) => {
    const service = getPlaneService();
    const workItem = await service.updateWorkItem(context.id, {
      name: context.name,
      description: context.description,
      status: context.status,
      priority: context.priority,
      assigneeId: context.assigneeId,
      estimate: context.estimate,
      startDate: context.startDate,
      dueDate: context.dueDate,
      labels: context.labels,
    });
    return workItem;
  },
});

export const deleteWorkItemTool = createTool({
  id: 'plane_delete_work_item',
  description: 'Delete a work item from Plane (requires confirmation)',
  inputSchema: z.object({
    id: z.string().describe('The ID of the work item to delete'),
    confirm: z.boolean().describe('Must be true to confirm deletion'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
  }),
  execute: async ( context ) => {
    if (!context.confirm) {
      return {
        success: false,
        message: 'Deletion not confirmed. Set confirm=true to proceed.',
      };
    }

    const service = getPlaneService();
    await service.deleteWorkItem(context.id);
    return {
      success: true,
      message: `Work item ${context.id} deleted successfully`,
    };
  },
});

export const listWorkItemsTool = createTool({
  id: 'plane_list_work_items',
  description: 'List work items from Plane with filtering and pagination',
  inputSchema: z.object({
    projectId: z.string().optional().describe('Filter by project ID'),
    assigneeId: z.string().optional().describe('Filter by assignee ID'),
    status: z.string().optional().describe('Filter by status'),
    priority: z.string().optional().describe('Filter by priority'),
    search: z.string().optional().describe('Search by name'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string(),
      priority: z.string().optional(),
      assigneeId: z.string().optional(),
      projectId: z.string(),
      estimate: z.number().optional(),
      startDate: z.string().optional(),
      dueDate: z.string().optional(),
      completedAt: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
      labels: z.array(z.string()).optional(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async (context ) => {
    const service = getPlaneService();
    const result = await service.listWorkItems({
      projectId: context.projectId,
      assigneeId: context.assigneeId,
      status: context.status,
      priority: context.priority,
      search: context.search,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Comment Tools
export const createCommentTool = createTool({
  id: 'plane_create_comment',
  description: 'Create a comment on a work item in Plane',
  inputSchema: z.object({
    workItemId: z.string().describe('The ID of the work item to comment on'),
    content: z.string().describe('The comment content'),
  }),
  outputSchema: z.object({
    id: z.string(),
    workItemId: z.string(),
    content: z.string(),
    htmlContent: z.string().optional(),
    authorId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const comment = await service.createComment({
      workItemId: context.workItemId,
      content: context.content,
    });
    return comment;
  },
});

export const listCommentsTool = createTool({
  id: 'plane_list_comments',
  description: 'List comments on a work item from Plane',
  inputSchema: z.object({
    workItemId: z.string().describe('The ID of the work item'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      workItemId: z.string(),
      content: z.string(),
      htmlContent: z.string().optional(),
      authorId: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async (context ) => {
    const service = getPlaneService();
    const result = await service.listComments(context.workItemId, {
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Project Tools
export const getProjectTool = createTool({
  id: 'plane_get_project',
  description: 'Get a project by ID from Plane',
  inputSchema: z.object({
    id: z.string().describe('The ID of the project to retrieve'),
  }),
  outputSchema: z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    status: z.string(),
    workspaceId: z.string(),
    leadId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const project = await service.getProject(context.id);
    return project;
  },
});

export const listProjectsTool = createTool({
  id: 'plane_list_projects',
  description: 'List projects from Plane with filtering and pagination',
  inputSchema: z.object({
    workspaceId: z.string().optional().describe('Filter by workspace ID'),
    status: z.string().optional().describe('Filter by status'),
    search: z.string().optional().describe('Search by name'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      status: z.string(),
      workspaceId: z.string(),
      leadId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async (context ) => {
    const service = getPlaneService();
    const result = await service.listProjects({
      workspaceId: context.workspaceId,
      status: context.status,
      search: context.search,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Cycle Tools
export const listCyclesTool = createTool({
  id: 'plane_list_cycles',
  description: 'List cycles for a project from Plane',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    status: z.string().optional().describe('Filter by status'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      projectId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async (context ) => {
    const service = getPlaneService();
    const result = await service.listCycles(context.projectId, {
      status: context.status,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Module Tools
export const listModulesTool = createTool({
  id: 'plane_list_modules',
  description: 'List modules for a project from Plane',
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    parentId: z.string().optional().describe('Filter by parent module ID'),
    status: z.string().optional().describe('Filter by status'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().optional(),
      projectId: z.string(),
      parentId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      status: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const result = await service.listModules(context.projectId, {
      parentId: context.parentId,
      status: context.status,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Member Tools
export const listMembersTool = createTool({
  id: 'plane_list_members',
  description: 'List members from Plane',
  inputSchema: z.object({
    workspaceId: z.string().optional().describe('Filter by workspace ID'),
    role: z.string().optional().describe('Filter by role'),
    search: z.string().optional().describe('Search by name or email'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
      avatarUrl: z.string().optional(),
      role: z.string(),
      workspaceId: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const result = await service.listMembers({
      workspaceId: context.workspaceId,
      role: context.role,
      search: context.search,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Relation Tools
export const createRelationTool = createTool({
  id: 'plane_create_relation',
  description: 'Create a relation between two work items in Plane',
  inputSchema: z.object({
    sourceId: z.string().describe('The source work item ID'),
    targetId: z.string().describe('The target work item ID'),
    type: z.enum(['blocks', 'relates_to', 'duplicates', 'is_blocked_by']).describe('The relation type'),
  }),
  outputSchema: z.object({
    id: z.string(),
    sourceId: z.string(),
    targetId: z.string(),
    type: z.string(),
    createdAt: z.string(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const relation = await service.createRelation({
      sourceId: context.sourceId,
      targetId: context.targetId,
      type: context.type,
    });
    return relation;
  },
});

export const listRelationsTool = createTool({
  id: 'plane_list_relations',
  description: 'List relations between work items from Plane',
  inputSchema: z.object({
    sourceId: z.string().optional().describe('Filter by source work item ID'),
    targetId: z.string().optional().describe('Filter by target work item ID'),
    type: z.string().optional().describe('Filter by relation type'),
    cursor: z.string().optional().describe('Pagination cursor'),
    page: z.number().optional().describe('Page number'),
    perPage: z.number().optional().describe('Items per page'),
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      id: z.string(),
      sourceId: z.string(),
      targetId: z.string(),
      type: z.string(),
      createdAt: z.string(),
    })),
    nextCursor: z.string().optional(),
    hasMore: z.boolean(),
    total: z.number().optional(),
  }),
  execute: async ( context ) => {
    const service = getPlaneService();
    const result = await service.listRelations({
      sourceId: context.sourceId,
      targetId: context.targetId,
      type: context.type,
      cursor: context.cursor,
      page: context.page,
      perPage: context.perPage,
    });
    return {
      items: result.items,
      nextCursor: result.nextCursor,
      hasMore: result.hasMore,
      total: result.total,
    };
  },
});

// Export all tools
export const planeTools = {
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
};