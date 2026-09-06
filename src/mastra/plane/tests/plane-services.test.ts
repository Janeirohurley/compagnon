import { describe, it, expect, vi } from 'vitest';
import { WorkItemService } from '../services/work-item-service';
import { ProjectService } from '../services/project-service';
import { WorkspaceService } from '../services/workspace-service';
import { planeTools } from '../tools/plane-tools';
import type { PlaneClient } from '../client/plane-client';

describe('Plane services', () => {
  it('finds an existing work item by name', async () => {
    const client: PlaneClient = {
      request: vi.fn().mockResolvedValue({ results: [{ id: 'wi-1', name: 'Task A' }], next_cursor: undefined }),
    };

    const service = new WorkItemService(client);
    const found = await service.findByName('Task A');
    expect(found?.id).toBe('wi-1');
  });

  it('creates project payload with required name validation', async () => {
    const client: PlaneClient = {
      request: vi.fn().mockResolvedValue({ id: 'p-1', name: 'Project A', workspaceId: 'ws-1', status: 'active', createdAt: '2024-01-01', updatedAt: '2024-01-01' }),
    };

    const service = new ProjectService(client, 'ws-1');
    const created = await service.create({ name: 'Project A', workspaceId: 'ws-1', status: 'active' });
    expect(created.id).toBe('p-1');
  });

  it('exposes workspace-aware Plane tools', async () => {
    const client: PlaneClient = {
      request: vi.fn().mockResolvedValue({ results: [{ id: 'ws-1', name: 'Platform', slug: 'platform' }], next_cursor: undefined }),
    };

    const service = new WorkspaceService(client);
    const workspaces = await service.list({ search: 'platform' });
    expect(workspaces.items[0]?.slug).toBe('platform');
    expect(planeTools.getWorkspaceTool.id).toBe('plane_get_workspace');
    expect(planeTools.listWorkspacesTool.id).toBe('plane_list_workspaces');
  });
});
