// Per-workspace memory-maintenance schedule registration (Phase 3, TEST-007).
//
// `registerMemoryMaintenanceSchedules` calls `mastra.schedules.create` once per
// workspace, scoping each schedule's `inputData.resourceId` to the workspace id.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const listWorkspacesMock = vi.hoisted(() => vi.fn());

vi.mock('../store', () => ({
  listWorkspaces: listWorkspacesMock,
}));

describe('registerMemoryMaintenanceSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers one schedule per workspace with resourceId equal to the workspace id', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const mastra = { schedules: { create } } as never;
    listWorkspacesMock.mockResolvedValue([
      { id: 'w-a', name: 'A' },
      { id: 'w-b', name: 'B' },
    ]);

    const { registerMemoryMaintenanceSchedules } = await import('../schedules');
    await registerMemoryMaintenanceSchedules(mastra as never, '0 3 * * *');

    expect(create).toHaveBeenCalledTimes(2);
    const first = create.mock.calls[0][0];
    expect(first.id).toBe('memory-maintenance-w-a');
    expect(first.workflowId).toBe('memory-maintenance');
    expect(first.inputData).toEqual({ resourceId: 'w-a' });
    const second = create.mock.calls[1][0];
    expect(second).toMatchObject({ id: 'memory-maintenance-w-b' });
    expect(second.inputData).toEqual({ resourceId: 'w-b' });
  });

  it('keeps registering the remaining workspaces when one schedule collides', async () => {
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error('collision'))
      .mockResolvedValue(undefined);
    const mastra = { schedules: { create } } as never;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    listWorkspacesMock.mockResolvedValue([{ id: 'w-a' }, { id: 'w-b' }]);

    const { registerMemoryMaintenanceSchedules } = await import('../schedules');
    await registerMemoryMaintenanceSchedules(mastra as never, '0 3 * * *');

    expect(create).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});