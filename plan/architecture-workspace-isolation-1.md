---
goal: "Isoler Compagnon en workspaces : workspaceId=tenant partout (données : mémoire, conversations, connexions ; runtime : agents actifs, tools/MCP, racines fichiers ; config : modèle/instructions), en 3 phases exécutables, sans nouvelle base ni multi-instance"
version: 1.0
date_created: 2026-09-10
last_updated: 2026-09-10
owner: Compagnon
status: 'Planned'
tags: ['architecture', 'workspace', 'multi-tenant', 'isolation', 'refactor']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Compagnon est aujourd'hui **mono-locataire** : une instance Mastra unique (`src/mastra/index.ts:51`), 8 agents en **singletons module-level** (`src/mastra/agents/*/agent.ts`), un `resourceId` qui namespacera déjà la mémoire du compagnon — working memory et recall sémantique en `scope: "resource"` (`agents/companion/memory.ts:57-66`) et les conversations/threads (`routes/chat-routes.ts:194`) — mais rien d'autre : le `RequestContext` n'est injecté que dans `/chat` et `/chat/approvals` (`chat-routes.ts:122-131,162-165`), les routes spécialisées appellent les singletons sans scope (`routes/github-routes.ts:1,32`), les connexions n'ont pas de colonne tenant (`connections/connection-store.ts:25-28`), le cron maintenance est dur sur `"anonymous"` (`index.ts:109`), les outils fichiers pointent vers le `process.cwd()` (`tools/project-file-tools.ts:7-18`), et le modèle est global (`config/model-config.ts:1-8`).

Ce plan transforme le schéma implicite « `resourceId` » en un vrai concept **workspace** : un workspace = un tenant dont les données (mémoire, conversations, connexions) et le runtime (agents actifs, sous-agents, tools/MCP, racines fichiers) et la config (modèle, instructions) sont **indépendants**. Niveau 1→2 de la refonte (identité + runtime configurable), **sans** isolation physique multi-instance (niveau 3, écarté en ALT-001).

Vérité d'implémentation : **`workspaceId` === `resourceId`** (CON-002). On ne renomme pas les colonnes : `resourceId` reste la clé de tenancy déjà gérée par Mastra (RequestContext `MASTRA_RESOURCE_ID_KEY`, scopes `"resource"`), et `workspaceId` en est la valeur côté application. C'est ce qui rend la migration additive et à faible risque.

Validé sur le code réel (2026-09-10) : singletons, RequestContext, scopes mémoire, tables citées. Exécutable de façon déterministe par une IA ou un humain.

## 1. Requirements & Constraints

- **REQ-001**: `workspaceId` est la clé de tenancy : toute requête porte un `workspaceId` qui alimente `resourceId` dans `RequestContext`/mémoire ; les données (working memory, recall, threads, conversations, connexions) sont isolées par workspace.
- **REQ-002**: Les **agents actifs** sont per-workspace : la config d'un workspace liste les sous-agents activés (ex. sans `notion`), et le companion ne leur expose ni sous-agent, ni tool, ni MCP correspondants.
- **REQ-003**: La **mémoire est totalement indépendante** par workspace (working memory, recall sémantique, historique par thread) — c'est déjà le cas au niveau `resourceId`, il faut brancher le workspaceId partout.
- **REQ-004**: Les **outils fichiers** (list/read/write/edit/delete project file) agissent dans la **racine du workspace** (`config.projectPath`), plus jamais `findProjectRoot()` depuis `cwd`.
- **REQ-005**: **Modèle et instructions configurés par workspace** avec fallback sur l'env global (`OMNIROUTE_*`).
- **REQ-006**: Les **connexions** (OAuth Notion, providers) sont scopées par workspace (colonne `workspace_id`).
- **REQ-007**: La **maintenance mémoire** (cron) itère tous les workspaces au lieu du `"anonymous"` hardcodé (`index.ts:109`).
- **REQ-008**: **Rétrocompat** : un workspace `"default"` est bootstrappé à la première exécution ; toute requête sans `workspaceId` (ni header `x-workspace-id`, ni body) y tombe.
- **REQ-009**: Le flux HITL `/chat` → `/chat/approvals` (reprise de run) continue de fonctionner à l'identique pour un workspace donné.
- **SEC-001**: Pas d'écriture cross-workspace : la résolution du workspace se fait **avant** tout accès storage ; un middleware central (TASK-003) est l'unique passeur.
- **SEC-002**: Les secrets de connexion restent chiffrés par `APP_ENCRYPTION_KEY` ; le scope `workspace_id` n'altère pas le chiffrement mais empêche la **lecture** d'une connexion d'un autre workspace.
- **SEC-003**: Sanctuaire fichiers conservé : les chemins se résolvent dans `config.projectPath` du workspace et la garde `projectPath()` (`tools/project-file-tools.ts:33-42`, blocage `..`) est maintenue.
- **CON-001**: **Aucune nouvelle base** pour le niveau 1→2 : un seul `mastra.db` (env `TURSO_DATABASE_URL`), tenancy par colonne/clé comme aujourd'hui.
- **CON-002**: `workspaceId` est un **alias applicatif** de `resourceId` : pas de renommage de colonnes ni de migration cloud massif (ALT-003 écarté).
- **CON-003**: Les routes gardent chemins et formes de réponse ; ajout d'un champ `workspaceId` dans body/query (et du header `x-workspace-id`).
- **CON-004**: Pendant la Phase 2, les exports singletons (ex. `companionAgent`, `githubAgent`) restent en tant qu'instance du workspace `"default"` afin de limiter la casse des tests, puis sont retirés à TASK-015.
- **CON-005**: Utiliser les scripts `dev` / `build` de `package.json` (reglè AGENTS.md), ne pas invoquer `mastra dev`/`mastra build` directement.
- **GUD-001**: Tout le code workspace vit dans `src/mastra/workspaces/` (types : résolution + cache runtime) ; **aucun** `process.env` lu ailleurs pour la résolution de workspace (PAT-002).
- **GUD-002**: Suivre l'architecture module existante (domains/services/tools/routes) et les conventions vitest du repo (`src/mastra/__tests__/`).
- **GUD-003**: Validations de fin de phase : `npx tsc --noEmit`, `npm test`, `npm run build` verts (voir section 6 pour les tests nouveaux).
- **GUD-004**: Vérifier les APIs Mastra dans `node_modules/@mastra/*/dist/docs` (skill `mastra`) avant tout code touchant `Memory`, `RequestContext` ou `Mastra` — jamais de mémoire.
- **PAT-001**: **Fabrique d'agents paramétrée** : `createXAgent(cfg)` remplace chaque singleton ; un **cache runtime** `getWorkspaceRuntime(workspaceId)` (`workspaces/runtime.ts`) construit et met en cache l'ensemble agents/tools/MCP par workspace.
- **PAT-002**: **Middleware unique de résolution** : header `x-workspace-id` > body/query `workspaceId` > `"default"`, injecté dans `RequestContext` (clé `MASTRA_RESOURCE_ID_KEY`) et loggé.
- **PAT-003**: **Registre SQL `workspaces`** : `id` (=`resourceId`), `name`, `slug`, `project_path`, `enabled_agents` (JSON), `model` (JSON optional), `instructions` (optional), `created_at`/`updated_at` ; bootstrap du `"default"` idempotent.

## 2. Implementation Steps

### Implementation Phase 1 — Identité & tenancy des données

- GOAL-001: Introduire `workspaceId` comme tenancy unique (alias `resourceId`), l'injecter dans toutes les routes et isoler données (mémoire, conversations, connexions) et maintenance.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/mastra/workspaces/types.ts` : `Workspace`, `WorkspaceConfig { projectPath: string; enabledAgents: string[]; model?: { providerId; modelId; url?; apiKey? }; instructions?: string }`, `WorkspaceStore`. | | |
| TASK-002 | Créer `src/mastra/workspaces/store.ts` : table `workspaces` (`id` PK, `name`, `slug`, `config` JSON, `created_at`, `updated_at`) via `createClient` LibSQL partagé (`TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`, même fichier que `mastra.db`) ; `getWorkspace(id)`, `listWorkspaces()`, `createWorkspace({id,name,slug,config})` ; `createClient` lancé dans un `createClient.prepare`... utiliser `CREATE TABLE IF NOT EXISTS` sur un client LibSQL (pas besoin de migration fragile). Bootstrap idempotent : si `"default"` absent → `INSERT` avec `projectPath=process.cwd()`, `enabledAgents:["memory","planner","github","outline","notion","plane","research"]`, fallback env. | | |
| TASK-003 | Créer `src/mastra/workspaces/resolve.ts` : `resolveWorkspaceId(header?: string, body?: string, query?: string): string` → champ non vide > `"default"`. Middleware Hono : lire `x-workspace-id` (header), puis `workspaceId` (body/query), injecter dans `RequestContext` avant handler (clés `MASTRA_RESOURCE_ID_KEY` et locale `workspaceId`), log `console.debug` de la résolution. | | |
| TASK-004 | `agents/companion/memory-context.ts:15-24` : `resolveMemoryIds` accepte `workspaceId` en priorité avant `resourceId`/`userId` → `resourceId = workspaceId || resourceId || userId || "anonymous"`. | | |
| TASK-005 | `routes/chat-routes.ts` : en `/chat` et `/chat/approvals`, appeler le middleware de résolution ; propager `workspaceId` dans le `RequestContext` (3 clés + `resourceId` de `MASTRA_MEMORY_KEY`) ; `/conversations` GET : filtrer `listThreads({ resourceId: workspaceId })` ; POST/PATCH/DELETE idem. | | |
| TASK-006 | `routes/memory-routes.ts` : `/memory/remember`, `/memory/list`, `/memory/search`, `/memory/workflow` : résoudre et propager `workspaceId` → `resourceId` (via `resolveMemoryIds`) dans `memoryFindTool.execute`/`getWorkingMemory`/workflow. | | |
| TASK-007 | Routes spécialisées `routes/{github,outline,notion,research,planner}-routes.ts` : accepter `workspaceId` dans le body et l'injecter dans les options de `generate({},{memory:{thread,resource}})` (via `generateWithMemory` où applicable). | | |
| TASK-008 | `connections/connection-store.ts` : ajouter la colonne `workspace_id TEXT` ; `StoredConnection.workspaceId` ; upsert/list/get/delete filtres `WHERE workspace_id = ?` . Migration : dans `init()` (`CREATE TABLE IF NOT EXISTS`), `ALTER TABLE` en try/catch si colonne absente, backfill `'default'`. Les routes `/connections*` exposent `workspace_id` depuis la résolution. | | |
| TASK-009 | `index.ts:101-113` : remplacer le cron `inputData: { resourceId: "anonymous" }` par un enregistrement qui itère `listWorkspaces()` et crée un schedule par workspace (`inputData: { resourceId: w.id }`), toujours best-effort en try/catch. | | |
| TASK-010 | Tests Phase 1 : TDD — mémoire isolée entre 2 workspaces (voir TEST-001/002/003/006 ci-dessous), migrations connexions, bootstrap idempotent. `npx tsc --noEmit` + `npm test` verts. | | |

### Implementation Phase 2 — Runtime par workspace (usine d'agents + agents actifs)

- GOAL-002: Convertir les 8 singletons en fabriques paramétrées, construire un runtime par workspace (agents actifs + tools/MCP lazy) et détacher les routes des singletons.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | `agents/companion/agent.ts` : extraire `createCompanionAgent(cfg: WorkspaceConfig, workspaceId: string)` qui reproduit l'agent actuel (`id`/`name`/`instructions`/`model` depuis `getCompanionModelConfig(cfg.model)`/`memory`/`skills`/`tools`/`agents`), avec `memory: getCompanionMemory()` (inchangé : storage unique, tenancy par resource) et **suppression du top-level await `mcpTools` (`agent.ts:25`)** → `mcpTools` chargés lazy injectés dans `tools` (résolution au moment du run via callback si l'API le permet, sinon pré-résolus par le runtime en TASK-013). Garder un export `agent = createCompanionAgent(DEFAULT)` (CON-004). | | |
| TASK-012 | Extraire les 7 fabriques sœurs dans `agents/{planner,plane,outline,notion,github,memory,research}/agent.ts` : `createPlannerAgent(cfg)`, `createPlaneAgent(cfg)`, `createOutlineAgent(cfg)`, `createNotionAgent(cfg)`, `createGithubAgent(cfg)`, `createMemoryAgent(cfg)`, `createResearchAgent(cfg)` — mêmes modèles (config workspace si présente, sinon `companionModel`), mêmes MCP mais **résolus lazy par workspace**. | | |
| TASK-013 | Créer `src/mastra/workspaces/runtime.ts` : `getWorkspaceRuntime(workspaceId)` avec cache `Map<workspaceId, WorkspaceRuntime>` ; construit `companion = createCompanionAgent(cfg, workspaceId)` où `agents` = fabriques des agents dans `cfg.enabledAgents` et `tools` = natifs + MCP (servers filtrés par `cfg.enabledAgents` : server `notion` seulement si `notion` actif, de même github/plane/outline/web-search…). Invalidation explicite `dropWorkspaceRuntime(id)` appelée à la création/modif d'un workspace. | | |
| TASK-014 | `routes/{github,outline,notion,research,planner}-routes.ts` : remplacer les imports singletons (ex. `routes/github-routes.ts:1`) par `const { agents } = getWorkspaceRuntime(workspaceId)` ; résolution workspaceId (TASK-003) **avant** `generate` ; 404 si l'agent n'est pas activé pour ce workspace. | | |
| TASK-015 | Supprimer les exports singletons restants (`companionAgent`/`githubAgent`/etc.) dès que `index.ts` et les routes passent tous par le runtime ; ne garder que `getWorkspaceRuntime`. Ajuster `src/mastra/index.ts:52` : `agents` alimentés par `getWorkspaceRuntime("default")`. | | |
| TASK-016 | Tests Phase 2 : activer/désactiver des agents par workspace (TEST-004), lazy MCP au run, régres défauts singletons → runtime (TEST-008). `npx tsc --noEmit` + `npm test` verts. | | |

### Implementation Phase 3 — Config par workspace (outils fichiers, modèle, UI)

- GOAL-003: Brancher la config workspace (racine fichiers, modèle, instructions) sur le runtime et exposer les workspaces dans l'UI.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-017 | `tools/project-file-tools.ts` : remplacer `findProjectRoot()` (`:7-18`) par `workspaceProjectRoot(workspaceId)` = `cfg.projectPath` (via runtime). Les fabriques d'outils doivent recevoir `projectRoot` à la construction pour éviter les courses. Garder la garde `projectPath()` (`:33-42`) sur `projectRoot`. 5 tools `requireApproval: true` inchangés. | | |
| TASK-018 | `config/model-config.ts` : `getCompanionModelConfig(override?)` — si `cfg.model` présent, l'utiliser ; sinon env (`OMNIROUTE_PROVIDER_ID`/`OMNIROUTE_MODEL`/`OMNIROUTE_BASE_URL`/`OMNIROUTE_API_KEY`) ; défaut `gpt-4o-mini` conservé. | | |
| TASK-019 | Instructions par workspace : si `cfg.instructions` non vide, l'empiler au-dessus de `companionInstructions` (concaténation markdown délimitée) dans `createCompanionAgent`. | | |
| TASK-020 | `compagnon-ui` : `api.ts` recopie les fonctions avec paramètre `workspaceId` et header `x-workspace-id` ; page/barre de saisie : sélecteur de workspace (crée/sélectionne via POST `/workspaces` et GET `/workspaces` à ajouter au TASK-002) ; `Agent.tsx` passe `workspaceId` à `streamChat`/`approveToolCall`/conversations. | | |
| TASK-021 | `.env.example` : documenter `x-workspace-id`, `APP_ENCRYPTION_KEY`, `COMPANION_WORKSPACE_*` (optionnel) ; `MASTRA_DOCS.md`/`MEMORY_SYSTEM.md` : ajouter une section « Workspaces ». | | |
| TASK-022 | Tests E2E Phase 3 (TEST-005/007) + `npm run build` backend et UI verts ; récap validation GUD-003. | | |

## 3. Alternatives

- **ALT-001**: **Niveau 3 — multi-instance Mastra par workspace** (instance + storage/DB + caches + processus distincts par workspace). Donne l'isolation physique (règlementaire/sécurité). **Écarté** : surcoût ≥ 2 jours (cycle de vie des instances, démarrage, monitoring), aucune exigence actuelle de séparation physique, le LibSQL est déjà multi-keyed. Réévaluer si un workspace devient soumis à un régime de données particulier.
- **ALT-002**: **Zéro refactor** — ne garder que le scope `resourceId` existant, sans registre ni fabriques, et simplement envoyer un `resourceId` différent par « workspace » côté UI. **Écarté** : isole bien data (mémoire/conversations) mais rend impossible les **agents actifs**, les **racines fichiers** par workspace et la config modèle — c'était l'exigence REQ-002/004/005.
- **ALT-003**: **Renommer `resourceId` → `workspaceId`** partout (colonnes, RequestContext, scope memory). **Écarté** : casse la rétrocompat Mastra (`MASTRA_RESOURCE_ID_KEY`, scopes `"resource"` du Memory) et les données existantes pour un gain nominal ; CON-002 les aliases explicitement.

## 4. Dependencies

- **DEP-001**: `@mastra/core` `RequestContext` + `MASTRA_RESOURCE_ID_KEY`/`MASTRA_THREAD_ID_KEY` — déjà utilisées (`routes/chat-routes.ts:122-131`) ; le middleware (TASK-003) ne fait qu'étendre leur usage.
- **DEP-002**: `Memory` scopes `"resource"` (working memory + semantic recall) — déjà configurés (`agents/companion/memory.ts:57-66`) ; aucune refonte mémoire requise, uniquement la propagation du workspaceId.
- **DEP-003**: Repo UI `compagnon-ui` (`src/lib/api.ts`, `src/pages/Agent.tsx`) — couplage en Phase 3 uniquement.
- **DEP-004**: Skill `mastra` — vérifier les APIs (`node_modules/@mastra/*/dist/docs`) avant tout code sur `Memory`/`RequestContext`/`Mastra`. Reglè AGENTS.md.
- **DEP-005**: Scripts `package.json` (`dev`, `build`) et harnais vitest existant (`src/mastra/__tests__/`, 119 tests).

## 5. Files

- **FILE-001**: `src/mastra/workspaces/types.ts` (nouveau) — types `Workspace`/`WorkspaceConfig`.
- **FILE-002**: `src/mastra/workspaces/store.ts` (nouveau) — table `workspaces` + CRUD + bootstrap.
- **FILE-003**: `src/mastra/workspaces/resolve.ts` (nouveau) — middleware de résolution workspaceId.
- **FILE-004**: `src/mastra/workspaces/runtime.ts` (nouveau) — `getWorkspaceRuntime` + cache.
- **FILE-005**: `src/mastra/agents/companion/agent.ts` — fabrique `createCompanionAgent`, retrait du top-level await MCP.
- **FILE-006**: `src/mastra/agents/companion/memory.ts` — export du storage/`getCompanionMemory` inchangé (tenancy par resource).
- **FILE-007**: `src/mastra/agents/companion/memory-context.ts` — `resolveMemoryIds` priorité `workspaceId`.
- **FILE-008**: `src/mastra/routes/chat-routes.ts` — workspaceId dans `/chat`, `/chat/approvals`, `/conversations*`.
- **FILE-009**: `src/mastra/routes/memory-routes.ts` — scope workspaceId sur `/memory/*`.
- **FILE-010**: `src/mastra/routes/{github,outline,notion,research,planner}-routes.ts` — passage au runtime workspace.
- **FILE-011**: `src/mastra/connections/connection-store.ts` — colonne `workspace_id` + scoping.
- **FILE-012**: `src/mastra/index.ts` — agents via runtime, cron itérant les workspaces.
- **FILE-013**: `src/mastra/tools/project-file-tools.ts` — racine par workspace.
- **FILE-014**: `src/mastra/config/model-config.ts` — modèle avec override par workspace.
- **FILE-015**: `src/mastra/agents/{planner,plane,outline,notion,github,memory,research}/agent.ts` — fabriques paramétrées.
- **FILE-016**: `.env.example` — doc `x-workspace-id`, `APP_ENCRYPTION_KEY`, `COMPANION_WORKSPACE_*`.
- **FILE-017**: `src/mastra/__tests__/*` — tests d'isolation (voir section 6).
- **FILE-018**: `compagnon-ui/src/lib/api.ts` + `compagnon-ui/src/pages/Agent.tsx` — sélecteur workspace + propagation.
- **FILE-019**: `MASTRA_DOCS.md` / `MEMORY_SYSTEM.md` — section « Workspaces ».

## 6. Testing

- **TEST-001**: Isolation mémoire : deux workspaces `w-a`/`w-b` avec la même phrase de tâche → `getWorkingMemory`/`recall` de `w-a` ne contient jamais de contenu stocké sous `w-b`.
- **TEST-002**: Conversations scopées : `GET /conversations?workspaceId=w-a` ne retourne que les threads de `w-a`.
- **TEST-003**: Middleware : requête sans header ni body → résout `"default"` ; header `x-workspace-id` prioritaire sur le body.
- **TEST-004**: Agents actifs : workspace dont `enabledAgents` exclut `notion` → le runtime ne construit pas l'agent `notion`, `/notion` répond 404, et le companion n'a pas de tool MCP notion.
- **TEST-005**: Racine fichiers : `config.projectPath=/ws/guest-a` → `list_project_files`/`read_project_file` résolvent sous `/ws/guest-a` et rejettent `../` (garde `projectPath` maintenue).
- **TEST-006**: Connexions scopées : upsert d'une connexion sous `w-b` → `GET /connections?workspaceId=w-a` ne la liste pas (colonnes `workspace_id` vérifiées).
- **TEST-007**: Cron : mock `listWorkspaces()` → le schedule maintenance est enregistré par workspace avec `inputData.resourceId = w.id`.
- **TEST-008**: Régression : les 119 tests existants passent (imports singletons basculés sur `getWorkspaceRuntime("default")` à TASK-015), plus `npx tsc --noEmit` et `npm run build` backend + UI.

## 7. Risks & Assumptions

- **RISK-001**: **Casse des tests pendant la Phase 2** — beaucoup de tests importent les singletons agents (`src/mastra/__tests__/`). Mitigation : exports compat « default » (CON-004) jusqu'à TASK-015, puis bascule testée (TEST-008).
- **RISK-002**: **MCP top-level await / caches globaux** — `agents/companion/agent.ts:25` (top-level await) et caches module (`notion/mcp-tools.ts:3-4`). Mitigation : chargement lazy par runtime (TASK-011/012) + invalidation de cache à la création/modif d'un workspace.
- **RISK-003**: **Oubli d'un `workspaceId` côté UI** → chute silencieuse sur `"default"` (fuite de tenancy apparente). Mitigation : middleware journalise chaque résolution (console.debug) et SEC-001 impose la résolution avant storage ; TEST-003 couvre le fallback.
- **RISK-004**: **Concurrence d'écriture sur le même fichier `mastra.db`** entre workspaces — non bloquant : les tables sont key-value par clé tenancy déjà ; aucun verrou supplémentaire requis pour le niveau 1→2.
- **ASSUMPTION-001**: Un seul tenant humain réel aujourd'hui ; `"default"` bootstrappé suffit, l'accès multi-utilisateur n'est pas une exigence de cette refonte.
- **ASSUMPTION-002**: Pas d'isolation physique (niveau 3) requise à ce stade — réévaluable (ALT-001).
- **ASSUMPTION-003**: `resourceId === workspaceId` (un utilisateur = un workspace) ; pas de séparation user/workspace avant une exigence explicite.

## 8. Related Specifications / Further Reading

- [Plan précédent mémoire](refactor-memory-mastra-unification-1.md) — a posé les scopes `"resource"` réutilisés ici.
- [MASTRA_DOCS.md](../MASTRA_DOCS.md) — conventions du projet.
- [MEMORY_SYSTEM.md](../MEMORY_SYSTEM.md) — modèle mémoire Compagnon.
- [Skill mastra](../.agents/skills/mastra/SKILL.md) — vérifier les APIs avant tout code.