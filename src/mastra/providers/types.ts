// Provider Registry types (Phase 1.5).
//
// Two provider kinds:
//   - `native`: resolved by the Mastra model router as "providerId/modelId"
//     (e.g. "openai/gpt-4o") — inherited from the built-in provider registry,
//     zero code per vendor.
//   - `openai_compatible`: any endpoint speaking the OpenAI chat/embeddings
//     protocol (OmniRoute, a homelab API, a local server...). Resolved as an
//     `OpenAICompatibleConfig` object `{ providerId, modelId, url, apiKey }`
//     which `ModelRouterLanguageModel` / `ModelRouterEmbeddingModel` accept.
export type ProviderKind = 'native' | 'openai_compatible';

export type ProviderCapability = 'chat' | 'embeddings';

export type ModelProvider = {
  id: string;
  kind: ProviderKind;
  name: string;
  /** Router provider id (`"openai"`, `"anthropic"`, or the custom slug). */
  providerId: string;
  /** Base URL for `openai_compatible` kinds, always null for `native`. */
  baseUrl: string | null;
  /** Decrypted secret (internal only; never served by routes). */
  apiKey?: string;
  capabilities: ProviderCapability[];
  /** Advertised model ids (probed from `GET {baseUrl}/models` or manual). */
  models: string[];
  /** Default chat model for this provider (required when `chat` capable). */
  chatModelId: string;
  /** Default embedding model (required when `embeddings` capable). */
  embeddingModelId: string;
  isDefaultChat: boolean;
  isDefaultEmbedding: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

/** Projection safe for API responses: never exposes `apiKey`. */
export type PublicModelProvider = Omit<ModelProvider, 'apiKey'>;

export type ProbeResult = {
  models: { id: string }[];
  latencyMs: number;
};

export type ProviderInput = {
  id?: string;
  kind?: ProviderKind;
  name?: string;
  providerId?: string;
  baseUrl?: string | null;
  apiKey?: string;
  capabilities?: ProviderCapability[];
  models?: string[];
  chatModelId?: string;
  embeddingModelId?: string;
  isDefaultChat?: boolean;
  isDefaultEmbedding?: boolean;
  enabled?: boolean;
};