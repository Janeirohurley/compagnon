---
name: provider-platform
description: Construire ou étendre le Provider Registry de Compagnon — registre d'endpoints OpenAI-compatible configurable (baseUrl + apiKey + modèles) et héritage des providers natifs Mastra. Use when adding/adjusting model/provider resolution, the `model_providers` table, `/model-providers` routes, provider UI, or migrating `companionModel`/`getCompanionModelConfig` calls. Coverage keywords: provider, model, openai_compatible, OpenAICompatibleConfig, omniroute, model-providers, Provider Registry, embeddings, "connecter ma propre provider".
---

# Provider Platform

Architecture de résolution de modèles pour Compagnon. Deux kinds de providers, une seule représentation de config.

## Cœur : `OpenAICompatibleConfig`

`@mastra/core` (installé, v1.59.0) résout la même forme pour le chat (via `Agent.model` → `ModelRouterLanguageModel`) ET les embeddings (via `ModelRouterEmbeddingModel`) :

```ts
// natif — le router charge le package @ai-sdk/<provider>
{ model: "openai/gpt-4o" }                    // ModelRouterModelId (string)
// custom — endpoint OpenAI-compatible (OmniRoute, API maison, Ollama…)
{ providerId, modelId, url, apiKey, headers? } // OpenAICompatibleConfig
```

Ne JAMAIS retoucher `@ai-sdk` directement : `new ModelRouterEmbeddingModel(config)` et le champ `model` d'un Agent acceptent tous deux `string | OpenAICompatibleConfig`.

## Fichiers à connaître

| Fichier | Rôle |
|---|---|
| `src/mastra/providers/types.ts` | `ProviderKind`, `ModelProvider`, `PublicModelProvider` (sans `apiKey`), `ProbeResult` |
| `src/mastra/providers/registry.ts` | table `model_providers` (LibSQL partagé), CRUD, seed env, `probeModels(baseUrl, apiKey)` |
| `src/mastra/providers/resolve.ts` | `resolveChatModel(ref)`, `resolveEmbeddingModel(ref)`, `getDefaultChatRef()/getDefaultEmbeddingRef()` (memo + cache) |
| `src/mastra/config/crypto.ts` | `encryptObject`/`decryptObject` (AES-256-GCM, `APP_ENCRYPTION_KEY`) — partagé connexions + providers |
| `src/mastra/routes/provider-routes.ts` | `GET/POST /model-providers`, `PATCH/DELETE /model-providers/:id`, `POST /model-providers/probe` |
| `compagnon-ui/src/pages/Providers.tsx` | écran UI (test & connect, defaults chat/embeddings) |

## Règles d'exécution

1. **Plan** : suivre `plan/architecture-provider-registry-1.md` (Phase 1.5, entre workspace P1 et P2). Charger le skill `mastra` AVANT tout code Mastra (AGENTS.md), puis `customize-opencode` si on touche aux skills opencode.
2. **Jamais de secret dans les réponses** : toute sortie route passe par `toPublicProvider(p)` ; l'apiKey est chiffrée via `crypto.ts`, jamais loguée (le `serializeForSpan` du router l'exclut déjà).
3. **Bootstrap** : première lecture du registre → seed idempotent depuis `OMNIROUTE_*` (chat=omniroute ; embeddings=openrouter si `OPENROUTER_API_KEY`, sinon omniroute). Le fallback env reste si le registre est vide/désactivé (test-friendly).
4. **Migration des agents** : remplacer tout import `companionModel` par `resolveChatModel(getDefaultChatRef())` et `companionEmbeddingModel` par `resolveEmbeddingModel(getDefaultEmbeddingRef())` ; ne jamais casser `id`/`name` des agents ni le timing module (singletons conservés côté résolution par key + memo).
5. **Workspaces** : `WorkspaceConfig.model` ne stocke QUE `{ providerId, modelId }` (jamais url/apiKey) ; la résolution en chiffre à l'usage. Un `cfg.model` présent prime sur le défaut global.
6. **UI** : intégrer `/providers` dans `AppShell.tsx` navItems + `App.tsx` ; formulaire d'ajout = nom + baseUrl + apiKey + capabilities + *Test & connect* → `probeModelProvider` → liste de cases pour `models` ; defaults via toggles ; suppression gardée (dernier `is_default_chat` actif refusé).
7. **Validation** : `npx tsc --noEmit`, `npm test` (133 existants + `providers/tests`), `npm run build`. Vérifier `probeModels` (timeout 8s, `Authorization: Bearer` seulement si clé) et la découverte `GET {baseUrl}/models`.

## Pièges connus

- Ne pas écrire `createOpenAICompatible(...)` à la main pour chaque fournisseur — c'est ce qu'on retire (ALT-001).
- Ne pas recréer le modèle à chaque requête : memo par `providerId:modelId:url` + invalidation `refreshProviderCache()`.
- `removeProvider` doit bloquer la suppression du dernier `is_default_chat` actif (SEC/garde TEST-005).
- Les tests posent les env `OMNIROUTE_*` + `TURSO_DATABASE_URL` en tête de fichier AVANT l'import dynamique (patron `memory-factory.test.ts`).
- La clé `APP_ENCRYPTION_KEY` est partagée avec les connexions : toute rotation invalide les secrets au repos (RISK-003).