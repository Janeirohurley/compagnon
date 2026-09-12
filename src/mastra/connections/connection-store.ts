import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

import { decryptObject, encryptObject } from '../config/crypto';

export type ConnectionStatus = 'needs_config' | 'connected' | 'error' | 'disconnected';

export type ConnectionRecord = {
  id: string;
  workspaceId: string;
  provider: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  capabilities: string[];
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type StoredConnection = ConnectionRecord & {
  secrets: Record<string, unknown>;
};

const db = createClient({
  url: process.env.COMPANION_CONNECTIONS_DB_URL || process.env.TURSO_DATABASE_URL || 'file:./mastra.db',
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

let initialized: Promise<void> | undefined;

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS compagnon_connections (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL DEFAULT 'default',
      provider TEXT NOT NULL,
      name TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      is_default INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'needs_config',
      config_json TEXT NOT NULL,
      encrypted_secrets_json TEXT,
      capabilities_json TEXT NOT NULL DEFAULT '[]',
      last_checked_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // Migration (TASK-008): existing tables predate scoping. Add the tenant
  // column when absent; the DEFAULT 'default' backfills prior rows.
  const info = await db.execute('PRAGMA table_info(compagnon_connections)');
  const hasWorkspace = (info.rows as unknown as Array<{ name: string }>).some((r) => r.name === 'workspace_id');
  if (!hasWorkspace) {
    await db.execute("ALTER TABLE compagnon_connections ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'default'");
  }
}

async function ready() {
  initialized ??= init();
  await initialized;
}

function publicRecord(row: any): ConnectionRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id || 'default'),
    provider: String(row.provider),
    name: String(row.name),
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    status: row.status as ConnectionStatus,
    config: JSON.parse(String(row.config_json || '{}')),
    capabilities: JSON.parse(String(row.capabilities_json || '[]')),
    lastCheckedAt: row.last_checked_at ? String(row.last_checked_at) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function storedRecord(row: any): StoredConnection {
  return {
    ...publicRecord(row),
    secrets: decryptObject(row.encrypted_secrets_json ? String(row.encrypted_secrets_json) : null),
  };
}

export async function listConnections(workspaceId = 'default', provider?: string) {
  await ready();
  const result = provider
    ? await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE workspace_id = ? AND provider = ? ORDER BY created_at DESC', args: [workspaceId, provider] })
    : await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE workspace_id = ? ORDER BY provider, created_at DESC', args: [workspaceId] });

  return result.rows.map(publicRecord);
}

export async function getConnection(id: string, workspaceId = 'default') {
  await ready();
  const result = await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE id = ? AND workspace_id = ?', args: [id, workspaceId] });
  const row = result.rows[0];
  return row ? publicRecord(row) : null;
}

export async function getConnectionWithSecrets(id: string, workspaceId = 'default') {
  await ready();
  const result = await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE id = ? AND workspace_id = ?', args: [id, workspaceId] });
  const row = result.rows[0];
  return row ? storedRecord(row) : null;
}

export async function getDefaultConnectionWithSecrets(provider: string, workspaceId = 'default') {
  await ready();
  const result = await db.execute({
    sql: 'SELECT * FROM compagnon_connections WHERE provider = ? AND workspace_id = ? AND enabled = 1 ORDER BY is_default DESC, created_at DESC LIMIT 1',
    args: [provider, workspaceId],
  });
  const row = result.rows[0];
  return row ? storedRecord(row) : null;
}

export async function upsertConnection(input: {
  id?: string;
  workspaceId?: string;
  provider: string;
  name?: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  enabled?: boolean;
  isDefault?: boolean;
}) {
  await ready();
  const now = new Date().toISOString();
  const workspaceId = input.workspaceId || 'default';
  const id = input.id || randomUUID();
  const existing = input.id ? await getConnectionWithSecrets(input.id, workspaceId) : null;
  const provider = input.provider || existing?.provider;

  if (!provider) throw new Error('provider is required.');

  const record = {
    provider,
    name: input.name || existing?.name || provider,
    enabled: input.enabled ?? existing?.enabled ?? true,
    isDefault: input.isDefault ?? existing?.isDefault ?? false,
    status: existing?.status || 'needs_config',
    config: { ...(existing?.config || {}), ...(input.config || {}) },
    secrets: { ...(existing?.secrets || {}), ...(input.secrets || {}) },
    capabilities: existing?.capabilities || [],
  };

  if (record.isDefault) {
    await db.execute({ sql: 'UPDATE compagnon_connections SET is_default = 0 WHERE provider = ? AND workspace_id = ?', args: [provider, workspaceId] });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO compagnon_connections
      (id, workspace_id, provider, name, enabled, is_default, status, config_json, encrypted_secrets_json, capabilities_json, last_checked_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      workspaceId,
      provider,
      record.name,
      record.enabled ? 1 : 0,
      record.isDefault ? 1 : 0,
      record.status,
      JSON.stringify(record.config),
      encryptObject(record.secrets),
      JSON.stringify(record.capabilities),
      existing?.lastCheckedAt || null,
      existing?.lastError || null,
      existing?.createdAt || now,
      now,
    ],
  });

  return getConnection(id, workspaceId);
}

export async function setConnectionEnabled(id: string, enabled: boolean, workspaceId = 'default') {
  await ready();
  await db.execute({
    sql: 'UPDATE compagnon_connections SET enabled = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
    args: [enabled ? 1 : 0, new Date().toISOString(), id, workspaceId],
  });
  return getConnection(id, workspaceId);
}

export async function updateConnectionStatus(
  id: string,
  status: ConnectionStatus,
  capabilities: string[] = [],
  lastError: string | null = null,
  workspaceId = 'default',
) {
  await ready();
  await db.execute({
    sql: 'UPDATE compagnon_connections SET status = ?, capabilities_json = ?, last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ? AND workspace_id = ?',
    args: [status, JSON.stringify(capabilities), new Date().toISOString(), lastError, new Date().toISOString(), id, workspaceId],
  });
  return getConnection(id, workspaceId);
}
