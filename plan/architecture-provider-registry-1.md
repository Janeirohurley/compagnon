---
goal: Provider Registry — hériter des providers natifs Mastra + registre d'endpoints OpenAI-compatible configurable (backend + UI)
version: 1.0
date_created: 2026-09-10
owner: Compagnon
status: 'Done'
tags: [architecture, infrastructure, feature, providers]
---

# Introduction

`compagnon` n'utilise aujourd'hui qu'`OmniRoute`, codé en dur (`providers/omniroute.ts` : `companionModel`/`companionEmbeddingModel` + env `OMNIROUTE_*`), et `config/model-config.ts` renvoie un objet env. Or Mastra embarque déjà un registre de 300+ providers natifs (`@mastra/core` `PROVIDER_REGISTRY`/`PROVIDER_MODELS`) résolus par le model router en `"provider/model"`, et accepte les endpoints OpenAI-compatibles via le type `OpenAICompatibleConfig = { providerId, modelId, url?, apiKey? }` (le router `ModelRouterLanguageModel`/`ModelRouterEmbeddingModel` acceptent les deux formes).

Ce plan introduit un **Provider Registry** : le catalogue natif est hérité tel quel (zéro code par fournisseur), et un registre persistant d'endpoints **openai_compatible** (OmniRoute, API maison, serveur local, tout service `/chat/completions`) peut être ajouté depuis l'UI — nom + baseUrl + apiKey → probe → modèles → sélection des défauts (chat / embeddings). Le codage en dur est remplacé par une couche de résolution unique. Il s'insère comme **Phase 1.5**, entre la Phase 1 (workspaces, terminée) et la Phase 2 (usine d'agents) de `architecture-workspace-isolation-1.md` : la Phase 2 consommera `resolveChatModel(cfg.model)`.

![Status: Done](https://img.shields.io/badge/status-Done-green)

## 1. Requirements & Constraints

- **REQ-001**: Tout provider enregistrable doit être utilisable sans écrire de code : `native` → chaîne `"providerId/modelId"` du router Mastra ; `openai_compatible` → objet `OpenAICompatibleConfig { providerId, modelId, url, apiKey }` (type déjà supporté par `ModelRouterLanguageModel` et `ModelRouterEmbeddingModel`).
- **REQ-002**: Un utilisateur doit pouvoir enregistrer/éditer/supprimer un endpoint openai-compatible depuis l'UI (baseUrl + apiKey), avec test de connexion et découverte de ses modèles via `GET {baseUrl}/models`.
- **REQ-003**: La sélection des modèles par défaut (chat ET embeddings) est globalement configurable et utilisée par les 9 agents ; la sélection par workspace (`WorkspaceConfig.model`) reste prioritaire quand elle existe.
- **REQ-004**: Comportement actuel préservé sans configuration : le premier lancement se materialise (`seed`) en registrant OmniRoute depuis les env `OMNIROUTE_*` comme défaut chat+embeddings (fallback OpenRouter embeddings conservé quand `OPENROUTER_API_KEY` présent).
- **SEC-001**: Les clés API sont chiffrées au repos (AES-256-GCM, `APP_ENCRYPTION_KEY`) et ne sont jamais renvoyées par les routes publiques ni loguées.
- **SEC-002**: La route `probe` pointe vers des URLs arbitraires (risque SSRF) : temps de réponse borné (timeout), aucune auth ni donnée d'instance dans la requête, option allowlist documentée.
- **CON-001**: Même base LibSQL que le reste du backend (`TURSO_DATABASE_URL`, défaut `file:./mastra.db`) ; pas de base séparée.
- **CON-002**: `npx tsc --noEmit`, `npm test` (133 tests verts) et `npm run build` doivent rester verts à la fin (migration des imports `companionModel` incluse).
- **GUD-001**: Réutiliser le moule `connections` (secrets chiffrés, `resolveWorkspaceFromRequest`, routes `GET/POST`) et les primitives UI existantes (`ConnectDialog`, `connect-ui` shadcn).
- **PAT-001**: Le `Provider` public est une projection (`toPublicProvider`) sans secret ; l'instance de modèles est mémorisée par clé de résolution (pas de reconstruction à chaque appel).
- **PAT-002**: `APP_ENCRYPTION_KEY` vit dans `src/mastra/config/crypto.ts` partagé (connexions + providers), extrait depuis `connection-store.ts` sans changer son comportement.

## 2. Implementation Steps

### Implementation Phase A — Registre backend + secrets

- GOAL-001: Persistance des providers (`model_providers`) chiffrée, auto-seedée et probe-able.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Extraire la crypto partagée : créer `src/mastra/config/crypto.ts` avec `encryptObject(value: Record<string, unknown>): string` et `decryptObject(value: string \| null): Record<string, unknown>` (AES-256-GCM, clé `sha256(APP_ENCRYPTION_KEY \|\| 'compagnon-local-dev-key')`, format `iv.tag.encrypted` base64). Refactorer `src/mastra/connections/connection-store.ts` (lignes 2, 33-63) pour importer ces fonctions — comportement strictement identique (les tests connexions existants restent verts). | Yes | 2026-09-10 |
| TASK-002 | Créer `src/mastra/providers/types.ts` : `ProviderKind = 'native' \| 'openai_compatible'`, `ProviderCapability = 'chat' \| 'embeddings'`, `ModelProvider { id, kind, name, providerId, baseUrl: string \| null, apiKey?: string, capabilities: ProviderCapability[], models: string[] \| null, isDefaultChat: boolean, isDefaultEmbedding: boolean, enabled: boolean, createdAt, updatedAt }`, `PublicModelProvider = Omit<ModelProvider,'apiKey'>`, `ProbeResult { models: { id: string }[], latencyMs: number }`. | Yes | 2026-09-10 |
| TASK-003 | Créer `src/mastra/providers/registry.ts` : table `model_providers` (id TEXT PK, kind TEXT, name TEXT, provider_id TEXT, base_url TEXT, api_key_encrypted TEXT, capabilities_json TEXT '["chat","embeddings"]', models_json TEXT NULL, is_default_chat INTEGER, is_default_embedding INTEGER, enabled INTEGER, created_at TEXT, updated_at TEXT) via le client LibSQL partagé. Exports : `listProviders()`, `getProvider(id)`, `getDefaultChatProvider()`, `getDefaultEmbeddingProvider()`, `upsertProvider(input)`, `removeProvider(id)` (interdite si c'est le dernier `is_default_chat` actif), `setDefaultProvider(id, capability)`, `toPublicProvider(p)`, `probeModels(baseUrl, apiKey)` → `GET {baseUrl}/models` avec header `Authorization: Bearer {apiKey}` (omis si vide), timeout 8s, renvoie `ProbeResult` ou throw. Secrets via `crypto.ts` (TASK-001). Seed idempotent au premier appel: si aucune ligne, insérer `{ kind:'openai_compatible', providerId:'omniroute', baseUrl: OMNIROUTE_BASE_URL, apiKey: OMNIROUTE_API_KEY, models:[OMNIROUTE_MODEL, OMNIROUTE_EMBEDDING_MODEL \|\| 'text-embedding-3-small'], isDefaultChat: true }` ; si `OPENROUTER_API_KEY` présent, un second provider `openrouter` (`isDefaultEmbedding: true`, modèle `openai/text-embedding-3-small`), sinon `omniroute.isDefaultEmbedding = true`. | Yes | 2026-09-10 |

### Implementation Phase B — Résolution + dé-durcification

- GOAL-002: Remplacer `companionModel`/`getCompanionModelConfig` par une résolution unique (natif \| custom) mémorisée, sans changer le schéma de données du workspace.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-004 | Créer `src/mastra/providers/resolve.ts` : `resolveChatModel(config?: { providerId; modelId; url?; apiKey? })` → natif : `"providerId/modelId"` (string, résolu par le router Mastra) ; custom : objet `{ providerId, modelId, url, apiKey }` (type `OpenAICompatibleConfig`, `@mastra/core/llm`). `resolveEmbeddingModel(config?)` → `new ModelRouterEmbeddingModel(config \| "provider/model")` (import `@mastra/core/llm`). `getDefaultChatRef()`/`getDefaultEmbeddingRef()` : cache mémoire `Map` peuplé depuis `registry.ts` (TASK-003), `refreshProviderCache()` pour invalider, et fallback env `OMNIROUTE_*` si registre vide/désactivé. Memoize par clé `providerId:modelId:url`. | Yes | 2026-09-10 |
| TASK-005 | `src/mastra/config/model-config.ts` : réécrire `getCompanionModelConfig()` pour renvoyer `getDefaultChatRef()` (objet custom OU `{ providerId, modelId }` avec url/apiKey quotient du registre) ; conserver un fallback env identique à l'actuel si le registre n'a aucune ligne active. Signature inchangée. | | Yes | 2026-09-10 |
| TASK-006 | Dé-durcifier `providers/omniroute.ts` : supprimer le fichier et réécrire chaque import. `src/mastra/agents/companion/memory.ts` (lignes 10, 54, 68) : `companionModel` → `resolveChatModel(getDefaultChatRef())`, `companionEmbeddingModel` → `resolveEmbeddingModel(getDefaultEmbeddingRef())`. Agents `{planner,plane,outline,notion,github,research}` (`agent.ts` + `config.ts`) et `memory/agent.ts` : remplacer les imports `companionModel` par `resolveChatModel(getDefaultChatRef())` en tête de module (mêmes singletons qu'avant, résolus dynamiquement). Ne pas changer les `id`/`name` des agents ni le timer de traitement. | | Yes | 2026-09-10 |
| TASK-007 | `src/mastra/workspaces/store.ts` bootstrap (lignes 76-85) : ne plus recopier les env dans `WorkspaceConfig.model` ; poser `config.model = { providerId: getDefaultChatRef().providerId, modelId: getDefaultChatRef().modelId }` (url/apiKey résolus à l'usage via TASK-004). Utiliser `workspaces.test.ts` inchangé. | | Yes | 2026-09-10 |

### Implementation Phase C — Routes

- GOAL-003: Exposer le registre en API (proxy `x-workspace-id` inchangé pour les autres routes).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Créer `src/mastra/routes/provider-routes.ts` et l'enregistrer dans `apiRoutes` (`src/mastra/index.ts`) : `GET /model-providers` → `{ providers: PublicModelProvider[], native: getRegisteredProviders() }` ; `GET /model-providers/:id` → public ou 404 ; `POST /model-providers` → probe (TASK-003) puis `upsertProvider`, 400 si la probe échoue ; `PATCH /model-providers/:id` → mise à jour partielle (nom, models, capabilities, defaults, enabled ; apiKey ré-chiffrée si fournie ; probe optionnelle si baseUrl/apiKey changés) ; `DELETE /model-providers/:id` → garde du dernier `is_default_chat` actif, renvoie l'erreur « Cannot remove the last default chat provider. » ; `POST /model-providers/probe` → `{ baseUrl, apiKey? }` → `ProbeResult` (sans persistance). Toutes les réponses passent par `toPublicProvider` (jamais de secret). | | Yes | 2026-09-10 |

### Implementation Phase D — UI

- GOAL-004: Écran Provider Registry dans `compagnon-ui` : ajouter/éditer/tester/supprimer un endpoint openai_compatible et choisir les défauts chat/embeddings.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | `compagnon-ui/src/lib/api.ts` : ajouter `listModelProviders()`, `getModelProvider(id)`, `createModelProvider(input)` (name, baseUrl, apiKey, capabilities, models), `updateModelProvider(id, patch)`, `deleteModelProvider(id)`, `probeModelProvider({ baseUrl, apiKey? })`, `setModelProviderDefault(id, capability)` — en-tête `x-workspace-id` comme les appels existants. | | Yes | 2026-09-10 |
| TASK-010 | Créer `compagnon-ui/src/pages/Providers.tsx` (+ route dans `src/App.tsx` et entrée `{ label: 'Providers', icon: Server, path: '/providers' }` dans `src/components/layout/AppShell.tsx` navItems) : liste des providers (badge kind natif/openai_compatible, statut enabled, defaults chat/embeddings marqués), dialogue « Connect provider » (champs name/baseUrl/apiKey, switchs capabilities, bouton *Test & connect* qui appelle `probeModelProvider` puis affiche les modèles dans une liste à cases pour `models`), toggles isDefaultChat/isDefaultEmbedding, suppression avec confirmation. Clés jamais affichées (masquées après enregistrement ; champs à parser depuis `data.ts` ne sont pas requis). | | Yes | 2026-09-10 |

### Implementation Phase E — Validation

- GOAL-005: Couverture de tests Provider Registry + verdeur générale.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Écrire `src/mastra/providers/tests/providers.test.ts` et `resolve.test.ts` (chemins environnementés en tête de fichier comme `memory-factory.test.ts`) et ajouter `src/mastra/providers/tests` au glob `npm test` : TEST-001 résolution native vs custom ; TEST-002 CRUD + seed idempotent ; TEST-003 probe (fetch moké) ; TEST-004 secrets jamais renvoyés par `toPublicProvider` ; TEST-005 garde du dernier default. Vérifier `npx tsc --noEmit`, `npm test` (133 existants + nouveaux) et `npm run build` verts. | | Yes | 2026-09-10 |

## 3. Alternatives

- **ALT-001**: Paquets providers codés à la main (`createOpenAICompatible` par fournisseur comme pour OmniRoute). Rejeté — exige du code par fournisseur, exactement ce que la plateforme veut éviter ; le router Mastra couvre déjà l'OpenAI-compatible via `OpenAICompatibleConfig`.
- **ALT-002**: Clés API uniquement en env (état actuel). Rejeté — exclut l'enregistrement depuis l'UI et la multi-tenantisation par workspace.
- **ALT-003**: Un seul « provider global » figé (OmniRoute). Rejeté — ne répond pas à « ma propre provider » ni aux défauts chat vs embeddings séparables.
- **ALT-004**: Découvrir les modèles par un fichier de conf manuel pour chaque endpoint. Rejeté — `GET {baseUrl}/models` est le standard OpenAI-compatible et évite toute saisie.

## 4. Dependencies

- **DEP-001**: `@mastra/core` (`ModelRouterLanguageModel`, `ModelRouterEmbeddingModel`, `OpenAICompatibleConfig`, `getRegisteredProviders`) — installé (1.59.0) ; le resolver natif charge le package `@ai-sdk/*` du fournisseur via le router (offline : respecter `MASTRA_OFFLINE`).
- **DEP-002**: `@libsql/client` partagé (table `model_providers` dans `TURSO_DATABASE_URL`) — installé.
- **DEP-003**: `APP_ENCRYPTION_KEY` (déjà utilisé par connexions) pour l'apiKey au repos.
- **DEP-004**: `@ai-sdk/openai-compatible` 3.0.30 reste installé (candidat au retrait en Phase 2 ; sans impact ici).
- **DEP-005**: `compagnon-ui` (React + react-router + shadcn `connect-ui`, pattern `ConnectDialog`) pour l'écran Providers.

## 5. Files

- **FILE-001**: `src/mastra/config/crypto.ts` (nouveau) — chiffrement partagé.
- **FILE-002**: `src/mastra/connections/connection-store.ts` — refactor crypto (TASK-001).
- **FILE-003**: `src/mastra/providers/types.ts` (nouveau).
- **FILE-004**: `src/mastra/providers/registry.ts` (nouveau).
- **FILE-005**: `src/mastra/providers/resolve.ts` (nouveau).
- **FILE-006**: `src/mastra/providers/omniroute.ts` — supprimé (TASK-006).
- **FILE-007**: `src/mastra/config/model-config.ts` — réécrit (TASK-005).
- **FILE-008**: `src/mastra/agents/companion/memory.ts` + `agents/{planner,plane,outline,notion,github,research,memory}/agent.ts` + `config.ts` — imports modèles (TASK-006).
- **FILE-009**: `src/mastra/workspaces/store.ts` — bootstrap model (TASK-007).
- **FILE-010**: `src/mastra/routes/provider-routes.ts` (nouveau) + `src/mastra/index.ts` (enregistrement).
- **FILE-011**: `compagnon-ui/src/lib/api.ts` — fonctions providers (TASK-009).
- **FILE-012**: `compagnon-ui/src/pages/Providers.tsx` (nouveau) + `App.tsx` + `components/layout/AppShell.tsx` (TASK-010).
- **FILE-013**: `src/mastra/providers/tests/{providers,resolve}.test.ts` (nouveaux) + `package.json` (glob test).

## 6. Testing

- **TEST-001**: `resolveChatModel`/`resolveEmbeddingModel` — natif renvoie une chaîne `"provider/model"`, custom renvoie un objet `OpenAICompatibleConfig` avec url/apiKey quotients du registre.
- **TEST-002**: Registre — `upsertProvider`/`listProviders`/`getProvider`, seed idempotent (2 appels ⇒ 1 ligne) ; defaults lisibles.
- **TEST-003**: `probeModels` — fetch moké : `/models` parsé en `ProbeResult`, erreur réseau propagée, timeout 8s.
- **TEST-004**: `toPublicProvider` ne contient jamais `apiKey` ; l'enregistrement chiffre (`decryptObject` roundtrip).
- **TEST-005**: `removeProvider` sur l'unique `is_default_chat` actif → throw ; setDefault bascule les flags.
- **TEST-006**: Non-régression — les 133 tests existants + build restent verts après TASK-006.

## 7. Risks & Assumptions

- **RISK-001**: Providers natifs Mastra nécessitent que le package `@ai-sdk/<provider>` du fournisseur soit chargeable (auto-load par le router ; en environnement hors-ligne, activer `MASTRA_OFFLINE` et installer les packages à l'avance) — le catalogue natif est listé mais non activé par défaut.
- **RISK-002**: `probe` vers baseUrl arbitraire = surface SSRF locale — timeout 8s, apiKey non envoyée, allowlist optionnelle documentée (SEC-002).
- **RISK-003**: La clé d'instance au repos est `APP_ENCRYPTION_KEY` ; sa rotation invalide les secrets chiffrés (comme pour connexions) — documenté, non géré automatiquement.
- **ASSUMPTION-001**: Tout endpoint openai_compatible expose `GET {baseUrl}/models` (standard OpenAI). Sinon l'utilisateur peut saisir les modèles manuellement (`models` nullable).
- **ASSUMPTION-002**: L'endpoint d'embeddings d'un provider custom est sur le même `baseUrl` (`/embeddings`) ; un provider sans embeddings n'est jamais `isDefaultEmbedding`.
- **ASSUMPTION-003**: La sélection par workspace (Phase 2/3) consommera `WorkspaceConfig.model` déjà présent ; le registre fournit uniquement les défauts globaux en attendant.

## 8. Related Specifications / Further Reading

- `plan/architecture-workspace-isolation-1.md` (Phase 1.5 insérée avant sa Phase 2)
- API Mastra modèles : `@mastra/core` `llm/model/{router,embedding-router,shared.types}.d.ts` (installé), `OpenAICompatibleConfig`, `getRegisteredProviders`
- `.agents/skills/mastra/references/model-selection.md` (format `"provider/model"`)