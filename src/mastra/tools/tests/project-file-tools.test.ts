// Project-file tools tests (Phase 3, TEST-005).
//
// `createProjectFileTools(root)` closes every tool over `root`: paths are
// resolved inside it and `../` escapes are rejected by the guard, so two
// workspaces with different `projectPath`s never touch each other's files.
import { describe, it, expect, beforeAll } from 'vitest';
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProjectFileTools } from '../project-file-tools';

// `getCompanionTools` pulls the shared memory/connection chain which builds the
// embedding model eagerly; give it a resolvable env before the dynamic import.
process.env.OMNIROUTE_BASE_URL = 'https://api.omniroute.ai/v1';
process.env.OMNIROUTE_API_KEY = 'test-key';
process.env.OMNIROUTE_MODEL = 'gpt-4o-mini';
process.env.APP_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef';

let getCompanionTools: typeof import('../index')['getCompanionTools'];

// The generated `Tool` type requires a second (runtime-context) argument and
// wraps the result; cast for ergonomics, the runtime behavior is identical.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function run<T = any>(tool: any, input: Record<string, unknown>): Promise<T> {
  return (tool.execute as (args: unknown) => Promise<T>)(input);
}

function scratch(label: string): string {
  const dir = join(tmpdir(), `compagnon-filetools-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('createProjectFileTools', () => {
  beforeAll(async () => {
    ({ getCompanionTools } = await import('../index'));
  });

  it('lists and reads files inside the configured root only', async () => {
    const root = scratch('a');
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'docs', 'a.md'), '# A');

    const tools = getCompanionTools(root);
    const list = await run<{ success: boolean; entries?: string[] }>(tools.list_project_files, { path: '.' });
    expect(list.success).toBe(true);
    expect(list.entries).toContain('docs/');

    const read = await run<{ success: boolean; content?: string }>(tools.read_project_file, { path: 'docs/a.md' });
    expect(read.success).toBe(true);
    expect(read.content).toBe('# A');
  });

  it('rejects escapes outside the configured root', async () => {
    const root = scratch('b');
    writeFileSync(join(root, 'inside.txt'), 'in');
    // A real sibling file that the guard must keep unreachable.
    const outside = join(root, '..', `outside-${Date.now()}.txt`);
    writeFileSync(outside, 'TOP SECRET');

    const tools = createProjectFileTools(root);
    const read = await run<{ success: boolean; error?: string }>(tools.read_project_file, {
      path: `../${outside.split('/').pop()}`,
    });
    expect(read.success).toBe(false);
    expect(String(read.error)).toMatch(/inside the project/);

    const write = await run(tools.write_project_file, { path: '../evil.txt', content: 'x' });
    expect(write.success).toBe(false);
    expect(existsSync(join(root, '..', 'evil.txt'))).toBe(false);
  });

  it('writes, edits and deletes within the root', async () => {
    const root = scratch('c');
    const tools = createProjectFileTools(root);

    const written = await run(tools.write_project_file, { path: 'sub/note.txt', content: 'hello world' });
    expect(written.success).toBe(true);
    expect(readFileSync(join(root, 'sub', 'note.txt'), 'utf8')).toBe('hello world');

    const edited = await run(tools.edit_project_file, { path: 'sub/note.txt', oldText: 'world', newText: 'there' });
    expect(edited.success).toBe(true);
    expect(edited.replacements).toBe(1);
    expect(readFileSync(join(root, 'sub', 'note.txt'), 'utf8')).toBe('hello there');

    const deleted = await run(tools.delete_project_file, { path: 'sub', recursive: true });
    expect(deleted.success).toBe(true);
    expect(existsSync(join(root, 'sub'))).toBe(false);
  });

  it('falls back to the repository root when no projectPath is given', async () => {
    const tools = getCompanionTools();
    const list = await run<{ success: boolean; entries?: string[] }>(tools.list_project_files, {
      path: 'src/mastra',
    });
    expect(list.success).toBe(true);
    expect(list.entries).toContain('agents/');
  });
});