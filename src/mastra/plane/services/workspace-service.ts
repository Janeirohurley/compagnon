import type { PlaneClient } from '../client/plane-client';
import { PlaneError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { ListWorkspacesParams } from '../domain/contracts';
import type { Workspace } from '../domain/types';

export class WorkspaceService {
  constructor(private readonly client: PlaneClient) {}

  async get(id: string): Promise<Workspace> {
    try {
      return await this.client.request<Workspace>(`/workspaces/${id}`);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get workspace', 'PLANE_WORKSPACE_ERROR', undefined, error);
    }
  }

  async list(params: ListWorkspacesParams = {}): Promise<PaginatedResponse<Workspace>> {
    try {
      if (!params.search && !params.cursor && !params.page && !params.perPage) {
        throw new PlaneError(
          'Plane does not expose a global workspace listing endpoint. Provide the workspace slug or workspace name explicitly before listing projects and tasks.',
          'PLANE_WORKSPACE_ERROR'
        );
      }

      const response = await this.client.request<any>('/workspaces', {
        params: buildPaginationParams(params),
      });
      return parsePaginatedResponse<Workspace>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list workspaces', 'PLANE_WORKSPACE_ERROR', undefined, error);
    }
  }
}
