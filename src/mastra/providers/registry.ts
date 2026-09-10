// Provider Registry persistence (TASK-003).
//
// A `model_providers` table in the *same* LibSQL database as the rest of
// Compagnon. API keys are encrypted at rest (shared `config/crypto.ts`) and
// are never returned by route projections (`toPublicProvider`).
import { createClient, type Client } from "@libsql/client";

import { decryptObject, encryptObject } from "../config/crypto";
import type {
  ModelProvider,
  ProbeResult,
  ProviderCapability,
  ProviderInput,
  ProviderKind,
  PublicModelProvider,
} from "./types";

const DB_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

function newClient(): Client {
  return createClient({ url: DB_URL, authToken: DB_TOKEN || undefined });
}

const ALLOWED_CAPABILITIES: ProviderCapability[] = ["chat", "embeddings"];

let db: Client | undefined;
let initialized: Promise<void> | undefined;

function instance(): Client {
  db ??= newClient();
  return db;
}

function rowToProvider(row: Record<string, unknown>): ModelProvider {
  const apiKey = decryptObject(row.api_key_encrypted ? String(row.api_key_encrypted) : null)
    .apiKey;
  return {
    id: String(row.id),
    kind: row.kind as ProviderKind,
    name: String(row.name),
    providerId: String(row.provider_id),
    baseUrl: row.base_url ? String(row.base_url) : null,
    apiKey: typeof apiKey === "string" && apiKey.length > 0 ? apiKey : undefined,
    capabilities: JSON.parse(String(row.capabilities_json || "[]")),
    models: JSON.parse(String(row.models_json || "[]")),
    chatModelId: String(row.chat_model_id || ""),
    embeddingModelId: String(row.embedding_model_id || ""),
    isDefaultChat: Boolean(row.is_default_chat),
    isDefaultEmbedding: Boolean(row.is_default_embedding),
    enabled: Boolean(row.enabled),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/** Projection for API responses — secrets are dropped. */
export function toPublicProvider(provider: ModelProvider): PublicModelProvider {
  const { apiKey: _apiKey, ...rest } = provider;
  return rest;
}

/** Seed the default providers from env on first boot (idempotent). */
async function seed(): Promise<void> {
  const c = instance();
  const existing = await c.execute("SELECT id FROM model_providers LIMIT 1");
  if (existing.rows.length > 0) return;

  const now = new Date().toISOString();
  const baseURL = process.env.OMNIROUTE_BASE_URL;
  const apiKey = process.env.OMNIROUTE_API_KEY;
  const chatModel = process.env.OMNIROUTE_MODEL;
  const embeddingModel = process.env.OMNIROUTE_EMBEDDING_MODEL || "text-embedding-3-small";

  const rows: Array<{
    id: string;
    name: string;
    providerId: string;
    baseUrl: string;
    apiKey: string;
    capabilities: ProviderCapability[];
    models: string[];
    chatModelId: string;
    embeddingModelId: string;
    isDefaultChat: boolean;
    isDefaultEmbedding: boolean;
  }> = [];

  if (baseURL && apiKey && chatModel) {
    rows.push({
      id: "omniroute",
      name: "OmniRoute",
      providerId: "omniroute",
      baseUrl: baseURL,
      apiKey,
      capabilities: ["chat", "embeddings"],
      models: [chatModel, embeddingModel],
      chatModelId: chatModel,
      embeddingModelId: embeddingModel,
      isDefaultChat: true,
      // OpenRouter may take over embeddings below.
      isDefaultEmbedding: !process.env.OPENROUTER_API_KEY,
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    rows.push({
      id: "openrouter",
      name: "OpenRouter",
      providerId: "openrouter",
      baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      capabilities: ["embeddings"],
      models: [process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small"],
      chatModelId: "",
      embeddingModelId: process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small",
      isDefaultChat: false,
      isDefaultEmbedding: true,
    });
  }

  for (const r of rows) {
    await c.execute(
      `INSERT INTO model_providers
        (id, kind, name, provider_id, base_url, api_key_encrypted, capabilities_json,
         models_json, chat_model_id, embedding_model_id, is_default_chat,
         is_default_embedding, enabled, created_at, updated_at)
        VALUES (?, 'openai_compatible', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        r.id,
        r.name,
        r.providerId,
        r.baseUrl,
        encryptObject({ apiKey: r.apiKey }),
        JSON.stringify(r.capabilities),
        JSON.stringify(r.models),
        r.chatModelId,
        r.embeddingModelId,
        r.isDefaultChat ? 1 : 0,
        r.isDefaultEmbedding ? 1 : 0,
        now,
        now,
      ],
    );
  }
}

async function ready(): Promise<void> {
  initialized ??= (async () => {
    await instance().execute(`
      CREATE TABLE IF NOT EXISTS model_providers (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        name TEXT NOT NULL,
        provider_id TEXT NOT NULL,
        base_url TEXT,
        api_key_encrypted TEXT,
        capabilities_json TEXT NOT NULL DEFAULT '["chat","embeddings"]',
        models_json TEXT NOT NULL DEFAULT '[]',
        chat_model_id TEXT DEFAULT '',
        embedding_model_id TEXT DEFAULT '',
        is_default_chat INTEGER NOT NULL DEFAULT 0,
        is_default_embedding INTEGER NOT NULL DEFAULT 0,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
    await seed();
  })();
  await initialized;
}

export async function listProviders(): Promise<ModelProvider[]> {
  await ready();
  const result = await instance().execute(
    "SELECT * FROM model_providers ORDER BY is_default_chat DESC, name ASC",
  );
  return (result.rows as Record<string, unknown>[]).map(rowToProvider);
}

export async function getProvider(id: string): Promise<ModelProvider | null> {
  await ready();
  const result = await instance().execute("SELECT * FROM model_providers WHERE id = ?", [id]);
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToProvider(row) : null;
}

export async function getDefaultChatProvider(): Promise<ModelProvider | null> {
  await ready();
  const result = await instance().execute(
    "SELECT * FROM model_providers WHERE enabled = 1 AND is_default_chat = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToProvider(row) : null;
}

export async function getDefaultEmbeddingProvider(): Promise<ModelProvider | null> {
  await ready();
  const result = await instance().execute(
    "SELECT * FROM model_providers WHERE enabled = 1 AND is_default_embedding = 1 ORDER BY updated_at DESC LIMIT 1",
  );
  const row = result.rows[0] as Record<string, unknown> | undefined;
  return row ? rowToProvider(row) : null;
}

function normalize(input: ProviderInput): {
  kind: ProviderKind;
  name: string;
  providerId: string;
  baseUrl: string | null;
  apiKey?: string;
  capabilities: ProviderCapability[];
  models: string[];
  chatModelId: string;
  embeddingModelId: string;
} {
  const kind: ProviderKind = input.kind ?? "openai_compatible";
  const capabilities = (input.capabilities ?? ["chat"]).filter((c) =>
    ALLOWED_CAPABILITIES.includes(c),
  );
  const baseUrl = input.baseUrl ?? null;
  const providerId = input.providerId || (kind === "native" ? "" : input.id || "custom");
  const chatModelId = input.chatModelId ?? "";
  const embeddingModelId = input.embeddingModelId ?? "";
  return {
    kind,
    name: input.name || providerId,
    providerId,
    baseUrl,
    apiKey: input.apiKey,
    capabilities,
    models: input.models ?? (chatModelId ? [chatModelId] : []),
    chatModelId,
    embeddingModelId,
  };
}

export async function upsertProvider(input: ProviderInput): Promise<ModelProvider> {
  await ready();
  const now = new Date().toISOString();
  const id = input.id || input.providerId || "custom";
  const existing = input.id ? await getProvider(input.id) : null;
  const data = normalize(input);

  let apiKeyEncrypted = existing?.apiKey
    ? encryptObject({ apiKey: existing.apiKey })
    : null;
  if (data.apiKey) {
    apiKeyEncrypted = encryptObject({ apiKey: data.apiKey });
  }

  await instance().execute(
    `INSERT OR REPLACE INTO model_providers
      (id, kind, name, provider_id, base_url, api_key_encrypted, capabilities_json,
       models_json, chat_model_id, embedding_model_id, is_default_chat,
       is_default_embedding, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      data.kind,
      data.name,
      data.providerId,
      data.baseUrl,
      apiKeyEncrypted,
      JSON.stringify(data.capabilities),
      JSON.stringify(data.models),
      data.chatModelId,
      data.embeddingModelId,
      (input.isDefaultChat ?? existing?.isDefaultChat ?? 0) ? 1 : 0,
      (input.isDefaultEmbedding ?? existing?.isDefaultEmbedding ?? 0) ? 1 : 0,
      (input.enabled ?? existing?.enabled ?? true) ? 1 : 0,
      existing?.createdAt || now,
      now,
    ],
  );

  return (await getProvider(id)) as ModelProvider;
}

export async function setDefaultProvider(
  id: string,
  capability: ProviderCapability,
): Promise<ModelProvider> {
  await ready();
  const provider = await getProvider(id);
  if (!provider) throw new Error("Provider not found.");
  if (!provider.enabled) throw new Error("Cannot set default on a disabled provider.");
  if (!provider.capabilities.includes(capability)) {
    throw new Error(`Provider does not support "${capability}".`);
  }

  const column = capability === "chat" ? "is_default_chat" : "is_default_embedding";
  await instance().execute(
    `UPDATE model_providers SET ${column} = 0 WHERE enabled = 1`,
  );
  await instance().execute(`UPDATE model_providers SET ${column} = 1 WHERE id = ?`, [id]);
  return (await getProvider(id)) as ModelProvider;
}

export async function removeProvider(id: string): Promise<void> {
  await ready();
  const provider = await getProvider(id);
  if (!provider) throw new Error("Provider not found.");

  if (provider.isDefaultChat) {
    const others = await instance().execute(
      "SELECT COUNT(*) AS n FROM model_providers WHERE enabled = 1 AND is_default_chat = 1 AND id != ?",
      [id],
    );
    const count = Number(((others.rows[0] as Record<string, unknown>) || {}).n || 0);
    if (count === 0) {
      throw new Error("Cannot remove the last default chat provider.");
    }
  }

  await instance().execute("DELETE FROM model_providers WHERE id = ?", [id]);
}

/** Probe an OpenAI-compatible endpoint for its advertised models. */
export async function probeModels(
  baseUrl: string,
  apiKey?: string,
): Promise<ProbeResult> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Probe failed with HTTP ${res.status}.`);
    }
    const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
    const models = (body.data ?? [])
      .map((m) => ({ id: String(m.id ?? "").trim() }))
      .filter((m) => m.id.length > 0);

    return { models, latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timeout);
  }
}