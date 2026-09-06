import type { PlaneClient } from '../client/plane-client';
import { PlaneError, PlaneNotFoundError } from '../client/plane-errors';
import { buildPaginationParams, parsePaginatedResponse, type PaginatedResponse } from '../client/plane-pagination';
import type { ListMembersParams } from '../domain/contracts';
import type { Member } from '../domain/types';

export class MemberService {
  constructor(private readonly client: PlaneClient, private readonly defaultWorkspaceSlug?: string) {}

  async get(id: string): Promise<Member> {
    try {
      return await this.client.request<Member>(`/members/${id}`);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to get member', 'PLANE_MEMBER_ERROR', undefined, error);
    }
  }

  async list(params: ListMembersParams = {}): Promise<PaginatedResponse<Member>> {
    try {
      const response = await this.client.request<any>('/members', {
        params: {
          ...buildPaginationParams(params),
          workspace_id: params.workspaceId ?? this.defaultWorkspaceSlug,
          role: params.role,
          search: params.search,
        },
      });
      return parsePaginatedResponse<Member>(response);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneError('Failed to list members', 'PLANE_MEMBER_ERROR', undefined, error);
    }
  }

  async resolve(identifier: string): Promise<Member> {
    try {
      const members = await this.list({ search: identifier });
      const member = members.items.find((item) => item.name === identifier || item.email === identifier || item.id === identifier);
      if (member) return member;
      return await this.get(identifier);
    } catch (error) {
      if (error instanceof PlaneError) throw error;
      throw new PlaneNotFoundError('Member', identifier);
    }
  }
}
