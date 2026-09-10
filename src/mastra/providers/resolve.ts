// Model resolution layer (TASK-004).
//
// Single source of truth for picking chat / embedding models. Both provider
// kinds resolve to shapes the Mastra model router accepts out of the box:
//   - native:            "providerId/modelId"            (ModelRouterModelId)
//   - openai_compatible: { providerId, modelId, url, apiKey } (OpenAICompatibleConfig)
//
// The default refs are cached in memory. Synchronous reads (agent construction)
// fall back to the env shape until `refreshProviderCache()` hydrates the cache
// from the registry (called at startup and after provider mutations).
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

import {
  getDefaultChatProvider,
  getDefaultEmbeddingProvider,
} from "./registry";
import type { ModelProvider } from "./types";

/** Provider-neutral model reference consumed by the resolvers below. */
export type ModelRef = {
  providerId: string;
  modelId: string;
  url?: string;
  apiKey?: string;
};

type Cache = {
  chat: ModelRef;
  embedding: ModelRef;
};

let cache: Cache | undefined;

export function refreshProviderCache(): Promise<Cache> {
  return (async () => {
    const [chatProvider, embeddingProvider] = await Promise.all([
      getDefaultChatProvider(),
      getDefaultEmbeddingProvider(),
    ]);
    const chat = chatProvider ? refFromProvider(chatProvider, "chat") : envChatRef();
    const embedding = embeddingProvider
      ? refFromProvider(embeddingProvider, "embeddings")
      : envEmbeddingRef(chat);
    cache = { chat, embedding };
    return cache;
  })();
}

function refFromProvider(
  provider: ModelProvider,
  capability: "chat" | "embeddings",
): ModelRef {
  const modelId =
    capability === "chat"
      ? provider.chatModelId || provider.models[0] || ""
      : provider.embeddingModelId || provider.models[0] || "";
  return {
    providerId: provider.providerId,
    modelId,
    ...(provider.baseUrl ? { url: provider.baseUrl } : {}),
    ...(provider.apiKey ? { apiKey: provider.apiKey } : {}),
  };
}

function envChatRef(): ModelRef {
  return {
    providerId: process.env.OMNIROUTE_PROVIDER_ID || "omniroute",
    modelId: process.env.OMNIROUTE_MODEL || "gpt-4o-mini",
    ...(process.env.OMNIROUTE_BASE_URL ? { url: process.env.OMNIROUTE_BASE_URL } : {}),
    ...(process.env.OMNIROUTE_API_KEY ? { apiKey: process.env.OMNIROUTE_API_KEY } : {}),
  };
}

function envEmbeddingRef(chat: ModelRef): ModelRef {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      providerId: "openrouter",
      modelId: process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small",
      url: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
    };
  }
  return chat;
}

/**
 * Default chat ref. Synchronous: before `refreshProviderCache()` runs it uses
 * the env shape so agent construction stays deterministic (as before).
 */
export function getDefaultChatRef(): ModelRef {
  return cache?.chat ?? envChatRef();
}

/** Default embedding ref; resolves to the chat ref when the default provider
 * has no embedding model of its own. */
export function getDefaultEmbeddingRef(): ModelRef {
  if (cache?.embedding) return cache.embedding;
  return envEmbeddingRef(envChatRef());
}

/** Reset the cache (used by tests). */
export function __resetProviderCache(): void {
  cache = undefined;
}

/**
 * Resolve a chat model.
 * - native (`providerId` is a registered Mastra router provider): a string
 *   `"providerId/modelId"`.
 * - openai_compatible: an `OpenAICompatibleConfig` object.
 */
export function resolveChatModel(
  ref: ModelRef,
): string | { providerId: string; modelId: string; url?: string; apiKey?: string } {
  if (ref.url) {
    return {
      providerId: ref.providerId,
      modelId: ref.modelId,
      ...(ref.url ? { url: ref.url } : {}),
      ...(ref.apiKey ? { apiKey: ref.apiKey } : {}),
    };
  }
  return `${ref.providerId}/${ref.modelId}`;
}

/** Resolve an embedding model through the router (string | OpenAICompatibleConfig). */
export function resolveEmbeddingModel(ref: ModelRef): ModelRouterEmbeddingModel {
  return new ModelRouterEmbeddingModel({
    providerId: ref.providerId,
    modelId: ref.modelId,
    ...(ref.url ? { url: ref.url } : {}),
    ...(ref.apiKey ? { apiKey: ref.apiKey } : {}),
  });
}