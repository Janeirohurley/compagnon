import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneValidationError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { ListRelationsParams } from '../domain/contracts';
import type { Relation } from '../domain/types';

export class RelationService {
  constructor(private readonly client: PlaneClient) {}

  async create(data: Partial<Relation>): Promise<Relation> {
    try {
      if (!data.sourceId || !data.targetId) {
        throw new PlaneValidationError('sourceId and targetId are required');
      }
      return await this.client.request<Relation>('/relations', {
        method: 'POST',
        body: data,
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create relation', 'PLANE_RELATION_ERROR', undefined, error);
    }
  }

  async list(params: ListRelationsParams = {}): Promise<PaginatedResponse<Relation>> {
    try {
      const response = await this.client.request<any>('/relations', {
        params: {
          ...buildPaginationParams(params),
          source_id: params.sourceId,
          target_id: params.targetId,
          type: params.type,
        },
      });
      return parsePaginatedResponse<Relation>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list relations', 'PLANE_RELATION_ERROR', undefined, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.request(`/relations/${id}`, { method: 'DELETE' });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to delete relation', 'PLANE_RELATION_ERROR', undefined, error);
    }
  }
}
