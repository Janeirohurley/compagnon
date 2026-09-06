import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { Module } from '../domain/types';

export class ModuleService {
  constructor(private readonly client: PlaneClient) {}

  async get(id: string): Promise<Module> {
    try {
      return await this.client.request<Module>(`/modules/${id}`);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get module', 'PLANE_MODULE_ERROR', undefined, error);
    }
  }

  async list(projectId: string, params: { parentId?: string; status?: string; cursor?: string; page?: number; perPage?: number } = {}): Promise<PaginatedResponse<Module>> {
    try {
      const response = await this.client.request<any>(`/projects/${projectId}/modules`, {
        params: {
          ...buildPaginationParams(params),
          parent_id: params.parentId,
          status: params.status,
        },
      });
      return parsePaginatedResponse<Module>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list modules', 'PLANE_MODULE_ERROR', undefined, error);
    }
  }

  async create(projectId: string, data: Partial<Module>): Promise<Module> {
    try {
      if (!data.name || !data.name.trim()) throw new PlaneValidationError('Module name is required');
      return await this.client.request<Module>(`/projects/${projectId}/modules`, {
        method: 'POST',
        body: { ...data, projectId },
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create module', 'PLANE_MODULE_ERROR', undefined, error);
    }
  }

  async update(id: string, data: Partial<Module>): Promise<Module> {
    try {
      return await this.client.request<Module>(`/modules/${id}`, {
        method: 'PATCH',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to update module', 'PLANE_MODULE_ERROR', undefined, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.request(`/modules/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to delete module', 'PLANE_MODULE_ERROR', undefined, error);
    }
  }
}
