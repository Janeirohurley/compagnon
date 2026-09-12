// config.ts override resolution tests (feature-tools-dynamic-workspace-1).
//
// Per-workspace env/secrets must win over process.env when building MCP
// server definitions: a secret stored for a workspace takes precedence over a
// global .env value.
import { describe, it, expect } from 'vitest';

process.env.CONFIG_TEST_GLOBAL = 'env-value';
process.env.CONFIG_TEST_ONLY_GLOBAL = 'only-global';

import { interpolate, expandArgs, mapEnv, buildArgs, type McpServerConfig } from '../config';

const OVERRIDES = { CONFIG_TEST_SECRET: 'workspace-secret' };

describe('MCP config override resolution', () => {
  it('interpolate prefers overrides over process.env', () => {
    expect(interpolate('{{CONFIG_TEST_SECRET}}', OVERRIDES)).toBe('workspace-secret');
    expect(interpolate('{{CONFIG_TEST_GLOBAL}}', OVERRIDES)).toBe('env-value');
    expect(interpolate('{{CONFIG_TEST_ONLY_GLOBAL}}', OVERRIDES)).toBe('only-global');
    expect(interpolate('{{CONFIG_TEST_SECRET}}')).toBe('');
  });

  it('expandArgs resolves standalone placeholders with overrides', () => {
    expect(expandArgs(['--token={{CONFIG_TEST_SECRET}}', '{{CONFIG_TEST_GLOBAL}}'], OVERRIDES)).toEqual([
      '--token=workspace-secret',
      'env-value',
    ]);
  });

  it('mapEnv picks the override for a key already set by process.env', () => {
    process.env.CONFIG_TEST_GLOBAL = 'env-value';
    const env = mapEnv({ CONFIG_TEST_GLOBAL: '{{CONFIG_TEST_GLOBAL}}', CONFIG_TEST_SECRET: '{{CONFIG_TEST_SECRET}}' }, OVERRIDES);
    expect(env).toEqual({ CONFIG_TEST_GLOBAL: 'env-value', CONFIG_TEST_SECRET: 'workspace-secret' });
  });

  it('buildArgs triggers optional args from workspace overrides (per-machine SSH)', () => {
    const server: McpServerConfig = {
      id: 'ssh',
      agents: ['companion'],
      type: 'stdio',
      command: 'npx',
      args: ['-y', 'ssh-mcp'],
      optionalArgs: [{ whenEnv: 'COMPANION_SSH_CONFIG', args: ['--config={{COMPANION_SSH_CONFIG}}'] }],
    };

    delete process.env.COMPANION_SSH_CONFIG;
    const base = buildArgs(server);
    expect(base).toEqual(['-y', 'ssh-mcp']);

    process.env.COMPANION_SSH_CONFIG = '/etc/machine-a.json';
    const fromEnv = buildArgs(server);
    expect(fromEnv).toEqual(['-y', 'ssh-mcp', '--config=/etc/machine-a.json']);

    delete process.env.COMPANION_SSH_CONFIG;
    const fromWorkspace = buildArgs(server, { COMPANION_SSH_CONFIG: '/ws/machine-b.json' });
    expect(fromWorkspace).toEqual(['-y', 'ssh-mcp', '--config=/ws/machine-b.json']);
  });
});