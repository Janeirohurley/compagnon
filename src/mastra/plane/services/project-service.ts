import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneNotFoundError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { ListProjectsParams } from '../domain/contracts';
import type { Project } from '../domain/types';

export class ProjectService {
  constructor(private readonly client: PlaneClient, private readonly defaultWorkspaceSlug?: string) {}

  private getWorkspaceSlug(workspaceId?: string): string | undefined {
    return workspaceId ?? this.defaultWorkspaceSlug;
  }

  private buildProjectUrl(workspaceId?: string, projectId?: string): string {
    const workspaceSlug = this.getWorkspaceSlug(workspaceId);
    if (!workspaceSlug) {
      return projectId ? `/projects/${projectId}` : '/projects';
    }

    return projectId
      ? `/workspaces/${workspaceSlug}/projects/${projectId}/`
      : `/workspaces/${workspaceSlug}/projects/`;
  }

  async get(id: string, workspaceId?: string): Promise<Project> {
    try {
      return await this.client.request<Project>(this.buildProjectUrl(workspaceId, id));
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get project', 'PLANE_PROJECT_ERROR', undefined, error);
    }
  }

  async create(data: Partial<Project>): Promise<Project> {
    try {
      if (!data.name || !data.name.trim()) {
        throw new PlaneValidationError('Project name is required');
      }

      const workspaceSlug = this.getWorkspaceSlug(data.workspaceId);
      return await this.client.request<Project>(workspaceSlug ? `/workspaces/${workspaceSlug}/projects/` : '/projects', {
        method: 'POST',
        body: {
          ...data,
          workspaceId: data.workspaceId ?? this.defaultWorkspaceSlug,
        },
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create project', 'PLANE_PROJECT_ERROR', undefined, error);
    }
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    try {
      const workspaceSlug = this.getWorkspaceSlug(data.workspaceId);
      return await this.client.request<Project>(workspaceSlug ? `/workspaces/${workspaceSlug}/projects/${id}/` : `/projects/${id}`, {
        method: 'PATCH',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to update project', 'PLANE_PROJECT_ERROR', undefined, error);
    }
  }

  async archive(id: string): Promise<Project> {
    return this.update(id, { status: 'archived' });
  }

  async delete(id: string): Promise<void> {
    try {
      const workspaceSlug = this.getWorkspaceSlug();
      await this.client.request(workspaceSlug ? `/workspaces/${workspaceSlug}/projects/${id}/` : `/projects/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to delete project', 'PLANE_PROJECT_ERROR', undefined, error);
    }
  }

  async list(params: ListProjectsParams = {}): Promise<PaginatedResponse<Project>> {
    try {
      const workspaceId = params.workspaceId ?? this.defaultWorkspaceSlug;
      const endpoint = workspaceId ? `/workspaces/${workspaceId}/projects/` : '/projects';
      const response = await this.client.request<any>(endpoint, {
        params: {
          ...buildPaginationParams(params),
          workspace_id: workspaceId,
          status: params.status,
          search: params.search,
        },
      });
      return parsePaginatedResponse<Project>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list projects', 'PLANE_PROJECT_ERROR', undefined, error);
    }
  }

  async resolve(identifier: string): Promise<Project> {
    try {
      const projects = await this.list({ search: identifier });
      const match = projects.items.find((project) => project.name === identifier || project.id === identifier);
      if (match) return match;
      return await this.get(identifier);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneNotFoundError('Project', identifier);
    }
  }
}
