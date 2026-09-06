import type { PlaneClient } from '../client/plane-client';
import { PlaneError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { Comment } from '../domain/types';

export class CommentService {
  constructor(private readonly client: PlaneClient) {}

  async list(workItemId: string, params: { cursor?: string; page?: number; perPage?: number } = {}): Promise<PaginatedResponse<Comment>> {
    try {
      const response = await this.client.request<any>(`/work-items/${workItemId}/comments`, {
        params: buildPaginationParams(params),
      });
      return parsePaginatedResponse<Comment>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list comments', 'PLANE_COMMENT_ERROR', undefined, error);
    }
  }

  async create(workItemId: string, content: string): Promise<Comment> {
    try {
      return await this.client.request<Comment>(`/work-items/${workItemId}/comments`, {
        method: 'POST',
        body: { content },
      });
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to create comment', 'PLANE_COMMENT_ERROR', undefined, error);
    }
  }
}
