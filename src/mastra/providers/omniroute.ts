// OmniRoute is a local/remote OpenAI-compatible gateway. The chat model is used by
// every agent; the embedding model is used by the unified Mastra Memory (semantic
// recall). Both must be reachable at OMNIROUTE_BASE_URL (/chat/completions + /embeddings).
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ModelRouterEmbeddingModel } from "@mastra/core/llm";

const baseURL = process.env.OMNIROUTE_BASE_URL;
const apiKey = process.env.OMNIROUTE_API_KEY;
const openRouterApiKey = process.env.OPENROUTER_API_KEY;
const modelId = process.env.OMNIROUTE_MODEL;
const embeddingModelId = process.env.OMNIROUTE_EMBEDDING_MODEL || "text-embedding-3-small";

if (!baseURL) {
  throw new Error("OMNIROUTE_BASE_URL is not configured.");
}

if (!apiKey) {
  throw new Error("OMNIROUTE_API_KEY is not configured.");
}

if (!modelId) {
  throw new Error("OMNIROUTE_MODEL is not configured.");
}

const omniRouteFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");

  return fetch(input, {
    ...init,
    headers,
  });
};

export const omniRoute = createOpenAICompatible({
  name: "omniroute",
  baseURL,
  apiKey,
  fetch: omniRouteFetch,
});

export const companionModel = omniRoute.chatModel(modelId);

const openRouterBaseURL = process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";
const openRouterEmbeddingModelId =
  process.env.OPENROUTER_EMBEDDING_MODEL || "openai/text-embedding-3-small";

/**
 * Embedding model backed by POST {embedderBaseURL}/embeddings.
 *
 * The local OmniRoute gateway does not expose an embedding endpoint (its
 * upstream does not have OpenAI embedding credentials configured), so the
 * embeddings are served by OpenRouter using the existing OPENROUTER_API_KEY.
 * When that key is absent we fall back to OmniRoute to keep the previous
 * behaviour.
 *
 * Built through ModelRouterEmbeddingModel so it exposes the v2 embedding
 * contract expected by @mastra/memory ("provider/model" resolution is skipped
 * because the object config carries its own url/apiKey). The dimension is
 * probed at startup by the memory layer (1536 for text-embedding-3-small).
 */
export const companionEmbeddingModel = openRouterApiKey
  ? new ModelRouterEmbeddingModel({
      providerId: "openrouter",
      modelId: openRouterEmbeddingModelId,
      url: openRouterBaseURL,
      apiKey: openRouterApiKey,
      headers: { Accept: "application/json" },
    })
  : new ModelRouterEmbeddingModel({
      providerId: "omniroute",
      modelId: embeddingModelId,
      url: baseURL,
      apiKey,
      headers: { Accept: "application/json" },
    });