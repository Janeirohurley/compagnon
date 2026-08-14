import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';

export type ConnectionStatus = 'needs_config' | 'connected' | 'error' | 'disconnected';

export type ConnectionRecord = {
  id: string;
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

function encryptionKey() {
  return createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || 'compagnon-local-dev-key')
    .digest();
}

function encrypt(value: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(value: string | null) {
  if (!value) return {};

  const [iv, tag, encrypted] = value.split('.');
  if (!iv || !tag || !encrypted) return {};

  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64')),
      decipher.final(),
    ]).toString('utf8'),
  );
}

async function init() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS compagnon_connections (
      id TEXT PRIMARY KEY,
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
}

async function ready() {
  initialized ??= init();
  await initialized;
}

function publicRecord(row: any): ConnectionRecord {
  return {
    id: String(row.id),
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
    secrets: decrypt(row.encrypted_secrets_json ? String(row.encrypted_secrets_json) : null),
  };
}

export async function listConnections(provider?: string) {
  await ready();
  const result = provider
    ? await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE provider = ? ORDER BY created_at DESC', args: [provider] })
    : await db.execute('SELECT * FROM compagnon_connections ORDER BY provider, created_at DESC');

  return result.rows.map(publicRecord);
}

export async function getConnection(id: string) {
  await ready();
  const result = await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE id = ?', args: [id] });
  const row = result.rows[0];
  return row ? publicRecord(row) : null;
}

export async function getConnectionWithSecrets(id: string) {
  await ready();
  const result = await db.execute({ sql: 'SELECT * FROM compagnon_connections WHERE id = ?', args: [id] });
  const row = result.rows[0];
  return row ? storedRecord(row) : null;
}

export async function getDefaultConnectionWithSecrets(provider: string) {
  await ready();
  const result = await db.execute({
    sql: 'SELECT * FROM compagnon_connections WHERE provider = ? AND enabled = 1 ORDER BY is_default DESC, created_at DESC LIMIT 1',
    args: [provider],
  });
  const row = result.rows[0];
  return row ? storedRecord(row) : null;
}

export async function upsertConnection(input: {
  id?: string;
  provider: string;
  name?: string;
  config?: Record<string, unknown>;
  secrets?: Record<string, unknown>;
  enabled?: boolean;
  isDefault?: boolean;
}) {
  await ready();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = input.id ? await getConnectionWithSecrets(input.id) : null;
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
    await db.execute({ sql: 'UPDATE compagnon_connections SET is_default = 0 WHERE provider = ?', args: [provider] });
  }

  await db.execute({
    sql: `INSERT OR REPLACE INTO compagnon_connections
      (id, provider, name, enabled, is_default, status, config_json, encrypted_secrets_json, capabilities_json, last_checked_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      provider,
      record.name,
      record.enabled ? 1 : 0,
      record.isDefault ? 1 : 0,
      record.status,
      JSON.stringify(record.config),
      encrypt(record.secrets),
      JSON.stringify(record.capabilities),
      existing?.lastCheckedAt || null,
      existing?.lastError || null,
      existing?.createdAt || now,
      now,
    ],
  });

  return getConnection(id);
}

export async function updateConnectionStatus(
  id: string,
  status: ConnectionStatus,
  capabilities: string[] = [],
  lastError: string | null = null,
) {
  await ready();
  await db.execute({
    sql: 'UPDATE compagnon_connections SET status = ?, capabilities_json = ?, last_checked_at = ?, last_error = ?, updated_at = ? WHERE id = ?',
    args: [status, JSON.stringify(capabilities), new Date().toISOString(), lastError, new Date().toISOString(), id],
  });
  return getConnection(id);
}
