import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { Cycle } from '../domain/types';

export class CycleService {
  constructor(private readonly client: PlaneClient) {}

  async get(id: string): Promise<Cycle> {
    try {
      return await this.client.request<Cycle>(`/cycles/${id}`);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get cycle', 'PLANE_CYCLE_ERROR', undefined, error);
    }
  }

  async list(projectId: string, params: { status?: string; cursor?: string; page?: number; perPage?: number } = {}): Promise<PaginatedResponse<Cycle>> {
    try {
      const response = await this.client.request<any>(`/projects/${projectId}/cycles`, {
        params: {
          ...buildPaginationParams(params),
          status: params.status,
        },
      });
      return parsePaginatedResponse<Cycle>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list cycles', 'PLANE_CYCLE_ERROR', undefined, error);
    }
  }

  async create(projectId: string, data: Partial<Cycle>): Promise<Cycle> {
    try {
      if (!data.name || !data.name.trim()) throw new PlaneValidationError('Cycle name is required');
      return await this.client.request<Cycle>(`/projects/${projectId}/cycles`, {
        method: 'POST',
        body: { ...data, projectId },
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create cycle', 'PLANE_CYCLE_ERROR', undefined, error);
    }
  }

  async update(id: string, data: Partial<Cycle>): Promise<Cycle> {
    try {
      return await this.client.request<Cycle>(`/cycles/${id}`, {
        method: 'PATCH',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to update cycle', 'PLANE_CYCLE_ERROR', undefined, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.request(`/cycles/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to delete cycle', 'PLANE_CYCLE_ERROR', undefined, error);
    }
  }
}
