import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneNotFoundError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { ListWorkItemsParams } from '../domain/contracts';
import type { WorkItem } from '../domain/types';

export class WorkItemService {
  constructor(private readonly client: PlaneClient, private readonly defaultWorkspaceSlug?: string) {}

  private getWorkspaceSlug(workspaceId?: string): string | undefined {
    return workspaceId ?? this.defaultWorkspaceSlug;
  }

  private buildWorkItemUrl(projectId?: string, workItemId?: string, workspaceId?: string): string {
    const workspaceSlug = this.getWorkspaceSlug(workspaceId);

    if (projectId && workspaceSlug) {
      return workItemId
        ? `/workspaces/${workspaceSlug}/projects/${projectId}/work-items/${workItemId}/`
        : `/workspaces/${workspaceSlug}/projects/${projectId}/work-items/`;
    }

    if (workItemId) {
      return `/work-items/${workItemId}`;
    }

    return '/work-items';
  }

  async get(id: string, projectId?: string, workspaceId?: string): Promise<WorkItem> {
    try {
      return await this.client.request<WorkItem>(this.buildWorkItemUrl(projectId, id, workspaceId));
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get work item', 'PLANE_WORK_ITEM_ERROR', undefined, error);
    }
  }

  async create(data: Partial<WorkItem>): Promise<WorkItem> {
    try {
      if (!data.name || !data.name.trim()) {
        throw new PlaneValidationError('Work item name is required');
      }
      if (!data.projectId) {
        throw new PlaneValidationError('Project id is required to create a work item');
      }

      const workspaceId = this.getWorkspaceSlug();
      return await this.client.request<WorkItem>(workspaceId ? `/workspaces/${workspaceId}/projects/${data.projectId}/work-items/` : '/work-items', {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create work item', 'PLANE_WORK_ITEM_ERROR', undefined, error);
    }
  }

  async update(id: string, data: Partial<WorkItem>): Promise<WorkItem> {
    try {
      const workspaceId = this.getWorkspaceSlug();
      const projectId = data.projectId ?? this.defaultWorkspaceSlug;
      return await this.client.request<WorkItem>(projectId && workspaceId ? `/workspaces/${workspaceId}/projects/${projectId}/work-items/${id}/` : `/work-items/${id}`, {
        method: 'PATCH',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to update work item', 'PLANE_WORK_ITEM_ERROR', undefined, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const workspaceId = this.getWorkspaceSlug();
      await this.client.request(workspaceId ? `/work-items/${id}` : `/work-items/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to delete work item', 'PLANE_WORK_ITEM_ERROR', undefined, error);
    }
  }

  async list(params: ListWorkItemsParams = {}): Promise<PaginatedResponse<WorkItem>> {
    try {
      const projectId = params.projectId;
      const workspaceId = this.defaultWorkspaceSlug;
      const endpoint = projectId && workspaceId
        ? `/workspaces/${workspaceId}/projects/${projectId}/work-items/`
        : '/work-items';

      const response = await this.client.request<any>(endpoint, {
        params: {
          ...buildPaginationParams(params),
          project_id: projectId,
          assignee_id: params.assigneeId,
          status: params.status,
          priority: params.priority,
          search: params.search,
          labels: params.labels ? params.labels.join(',') : undefined,
        },
      });
      return parsePaginatedResponse<WorkItem>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list work items', 'PLANE_WORK_ITEM_ERROR', undefined, error);
    }
  }

  async search(query: string, params: Omit<ListWorkItemsParams, 'search'> = {}): Promise<PaginatedResponse<WorkItem>> {
    return this.list({ ...params, search: query });
  }

  async resolve(identifier: string): Promise<WorkItem> {
    try {
      const items = await this.list({ search: identifier });
      const match = items.items.find((item) => item.name === identifier || item.id === identifier);
      if (match) return match;
      return await this.get(identifier);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneNotFoundError('Work item', identifier);
    }
  }

  async findByName(name: string): Promise<WorkItem | null> {
    try {
      const items = await this.list({ search: name });
      return items.items.find((item) => item.name === name) ?? null;
    } catch {
      return null;
    }
  }
}
