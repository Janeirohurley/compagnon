// Default chat model configuration for the agent stack.
//
// Delegates to the provider registry (see `providers/resolve.ts`): registry
// defaults once hydrated (`refreshProviderCache()`), env fallback otherwise.
// The returned shape is the same as before (`{ providerId, modelId, url?,
// apiKey? }`), a drop-in `OpenAICompatibleConfig` for the Mastra model router.
//
// An optional per-workspace `WorkspaceModelConfig` override is applied when
// present (Phase 2): a workspace model records only the identity
// (providerId/modelId); url/apiKey are re-attached at use-time from the
// default chat ref when the override targets the same provider.
import { getDefaultChatRef, type ModelRef } from '../providers/resolve';
import type { WorkspaceModelConfig } from '../workspaces/types';

/**
 * Resolve the model ref for a workspace. Returns the override when it carries
 * a providerId+modelId; when the override points at the same provider as the
 * default chat provider the default ref's url/apiKey are kept so an
 * OpenAI-compatible workspace model keeps working. Falls back to the global
 * default chat ref otherwise.
 */
export function resolveWorkspaceModel(override?: WorkspaceModelConfig): ModelRef {
  if (override?.providerId && override?.modelId) {
    const def = getDefaultChatRef();
    if (override.providerId === def.providerId) {
      return { ...def, modelId: override.modelId };
    }
    return { providerId: override.providerId, modelId: override.modelId };
  }
  return getDefaultChatRef();
}

export function getCompanionModelConfig(override?: WorkspaceModelConfig): ModelRef {
  return resolveWorkspaceModel(override);
}