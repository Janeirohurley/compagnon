// Raw run-event store tests (feature-activity).
//
// Covers append/list round-trip fidelity (chunks are persisted verbatim),
// scoping by thread, cleanup on delete, and the SSE-chunk normalization.
import { describe, it, expect, beforeAll } from 'vitest';
import { unlinkSync } from 'node:fs';

const DB = '/tmp/compagnon-run-events-test.db';
for (const suffix of ['', '-wal', '-shm']) {
  try {
    unlinkSync(`${DB}${suffix}`);
  } catch {
    // file does not exist yet
  }
}
process.env.TURSO_DATABASE_URL = `file:${DB}`;

let appendRunEvents: typeof import('../run-events-store')['appendRunEvents'];
let listRunEvents: typeof import('../run-events-store')['listRunEvents'];
let deleteRunEventsForThread: typeof import('../run-events-store')['deleteRunEventsForThread'];
let toRunEventInput: typeof import('../run-events-store')['toRunEventInput'];

describe('Run events store', () => {
  beforeAll(async () => {
    ({ appendRunEvents, listRunEvents, deleteRunEventsForThread, toRunEventInput } = await import('../run-events-store'));
  });

  it('normalizes the main AI SDK v5 chunk types', () => {
    const meta = { threadId: 't1', workspaceId: 'ws1', projectId: 'p1' };
    expect(toRunEventInput({ type: 'start', messageId: 'm1' }, meta)).toMatchObject({ kind: 'start' });
    expect(toRunEventInput({ type: 'start-step' }, meta)).toMatchObject({ kind: 'step' });
    expect(toRunEventInput({ type: 'finish-step' }, meta)).toMatchObject({ kind: 'step' });
    expect(
      toRunEventInput({ type: 'tool-input-start', toolCallId: 'tc1', toolName: 'read_project_file' }, meta),
    ).toMatchObject({ kind: 'tool-input', toolCallId: 'tc1', toolName: 'read_project_file' });
    expect(toRunEventInput({ type: 'tool-output-available', toolCallId: 'tc1', output: { ok: true } }, meta)).toMatchObject({
      kind: 'tool-output',
      toolCallId: 'tc1',
    });
    expect(toRunEventInput({ type: 'data-tool-call-approval', data: { runId: 'r1' } }, meta)).toMatchObject({
      kind: 'approval',
    });
    expect(toRunEventInput({ type: 'finish', finishReason: 'stop' }, meta)).toMatchObject({ kind: 'finish' });
    expect(toRunEventInput({ type: 'unknown-thing' }, meta)).toMatchObject({ kind: 'other' });
    expect(toRunEventInput(null, meta)).toBeNull();
  });

  it('round-trips chunks verbatim, scoped by thread', async () => {
    await appendRunEvents([
      toRunEventInput({ type: 'start-step' }, { threadId: 't1', workspaceId: 'ws1' }) as NonNullable<ReturnType<typeof toRunEventInput>>,
      toRunEventInput(
        { type: 'tool-input-start', toolCallId: 'tc1', toolName: 'write_project_file' },
        { threadId: 't1', workspaceId: 'ws1', projectId: 'p1' },
      ) as NonNullable<ReturnType<typeof toRunEventInput>>,
      toRunEventInput(
        { type: 'tool-output-available', toolCallId: 'tc1', output: { path: '/p/a.txt' } },
        { threadId: 't1', workspaceId: 'ws1', projectId: 'p1' },
      ) as NonNullable<ReturnType<typeof toRunEventInput>>,
    ]);

    const events = await listRunEvents('t1');
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.kind)).toEqual(['step', 'tool-input', 'tool-output']);
    expect(events[1].toolCallId).toBe('tc1');
    expect(events[1].projectId).toBe('p1');
    expect(events[2].data).toEqual({ type: 'tool-output-available', toolCallId: 'tc1', output: { path: '/p/a.txt' } });

    expect(await listRunEvents('other-thread')).toHaveLength(0);
  });

  it('cleans the log when the conversation is deleted', async () => {
    await appendRunEvents([
      toRunEventInput({ type: 'finish' }, { threadId: 't2' }) as NonNullable<ReturnType<typeof toRunEventInput>>,
    ]);
    await deleteRunEventsForThread('t2');
    expect(await listRunEvents('t2')).toHaveLength(0);
  });
});