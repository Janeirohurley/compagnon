---
goal: "Unifier la mémoire de Compagnon sur Mastra Memory natif (storage LibSQL + vector + semantic recall + working memory + observational memory), migrer les données du sous-système custom et rendre la récupération réelle"
version: 1.0
date_created: 2026-09-07
last_updated: 2026-09-07
owner: Compagnon
status: 'Planned'
tags: ['refactor', 'architecture', 'memory', 'mastra', 'migration']
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

Compagnon possède actuellement **deux mémoires déconnectées** : (1) la mémoire conversationnelle Mastra (`new Memory` sur l'agent companion, historique de messages par thread) et (2) un **sous-système sémantique custom** (agent `memory-agent` + 18 tools + tables Turso/SQLite `semantic_memories`, `episodes`, `procedures`, `decisions`, `memory_conflicts`) dont la récupération est **décorative** (`retrieveRelevantMemories` ne fait que du `console.log`, `generateWithMemory` n'est appelé nulle part), la recherche est **keyword** (`includes`), l'extraction de faits est **regex** fragile, et la délégation repose sur un `JSON.parse(response.text)` libre.

Ce plan **abandonne le sous-système custom** et unifie tout sur **Mastra Memory natif** : `LibSQLStore` + `LibSQLVector` + semantic recall (embeddings) + working memory (faits, préférences, décisions, procédures) + observational memory (épisodes de long terme). La récupération devient réelle (injection dans le prompt), les données existantes sont migrées sans perte, le Memory Agent est réduit à 3 opérations natives explicites (`memory_find`, `memory_store`, `memory_forget`), et la maintenance est automatisée.

Ce plan **remplace** `plan/feature-professional-memory-1.md` (approche « étendre le custom » : snapshots/trends/recap/profil sur Turso) qui est obsolète.

Ce plan a été rédigé après vérification des APIs 1.25.x dans `node_modules/@mastra/memory` (docs embarquées) et du code existant de Compagnon. Il est exécutable de façon déterministe par une IA ou un humain.

---

## 1. Requirements & Constraints

- **REQ-001**: Une seule source de vérité mémoire — Mastra Memory natif. Le sous-système custom (tables SQL custom, `memoryManager`, 18 tools, hooks regex) est retiré de la surface de l'agent.
- **REQ-002**: La récupération mémoire est réelle : le contexte pertinent (`recall` sémantique + working memory) est **injecté dans le prompt** avant chaque génération, pas seulement loggé.
- **REQ-003**: La mémoire conversationnelle persiste par **thread** (`threadId`) et le working memory persiste par **resource** (`resourceId`, scope `resource`) — les préférences survivent aux threads.
- **REQ-004**: Le contexte de long terme reste borné : `lastMessages: 20` + observational memory (Observer/Reflector) qui remplace l'historique brut obsolète.
- **REQ-005**: Aucune donnée existante perdue : les tables custom (`semantic_memories`, `decisions`, `procedures`) sont migrées vers des blocs working-memory étiquetés ; les épisodes sont reconstruits par observational memory.
- **REQ-006**: Les opérations mémoire explicites restent disponibles : le plan executor (agent `memory`) et les routes `/memory/*` continuent de fonctionner, adossés aux primitives natives.
- **REQ-007**: La maintenance (déduplication, nettoyage, scrub) est **automatisée** (workflow + schedule quotidien), plus d'opérations manuelles uniquement.
- **SEC-001**: Aucun secret stocké dans la mémoire : `sanitizeForMemory` rejette tout texte contenant les motifs `sk-`, `ghp_`, `gho_`, `ghu_`, `xoxb-`, `AKIA`, `-----BEGIN` avant écriture en working memory.
- **SEC-002**: L'isolation resource/thread est respectée : `recall` et working memory requièrent explicitement `resourceId`/`threadId` ; le défaut `resourceId='anonymous'` est documenté.
- **CON-001**: Aucun nouveau service externe : les embeddings passent par l'endpoint OmniRoute existant (POST `{OMNIROUTE_BASE_URL}/embeddings`).
- **CON-002**: Même fichier LibSQL `mastra.db` (env `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN`) — pas de nouvelle base.
- **CON-003**: Compatibilité ascendante : `chatRoute` (historique par thread) et les routes `/memory/search`, `/memory/list`, `/memory/remember` gardent leurs chemins HTTP et formes de réponse.
- **CON-004**: Ne pas casser le flux plan → executor : les tâches `suggestedAgent: "memory"` du planner doivent produire un `completed` (id d'agent `memory` conservé dans `SPECIALIST_AGENTS`).
- **GUD-001**: Suivre l'architecture existante du module (domains/services/tools + `src/mastra/instructions`) et les conventions de test vitest du repo.
- **GUD-002**: Toutes les écritures mémoire passent par la fabrique `buildCompanionMemory()` (aucun `new Memory` dispersé).
- **GUD-003**: Validation de fin : `npx tsc --noEmit`, `npm test`, `npm run build` tous verts.
- **PAT-001**: Fabrique pour l'instanciation mémoire (`buildCompanionMemory`) ; wrapper pré/post pour l'injection (`generateWithMemory`).
- **PAT-002**: Répertoire `scripts/` pour les outils one-shot de migration avec flag `--dry-run`.

---

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Exposer un modèle d'embedding OmniRoute et créer la fabrique `buildCompanionMemory()` réutilisable pour toute l'application.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Modifier `src/mastra/providers/omniroute.ts` : `embeddingModelId = process.env.OMNIROUTE_EMBEDDING_MODEL || "text-embedding-3-small"` et `export const companionEmbeddingModel = new ModelRouterEmbeddingModel({ providerId: "omniroute", modelId: embeddingModelId, url: baseURL, apiKey, headers: { Accept: "application/json" } })` — chemin object config → POST `{baseURL}/embeddings` (compatible OpenAI). **Déviation** : pas `omniRoute.embeddingModel()` (le router n'expose pas la méthode — RISK-001 fermé, aucun registry global requis). `npx tsc --noEmit` vert. | ✅ | 2026-09-07 |
| TASK-002 | Créer `src/mastra/agents/companion/memory.ts` avec `buildCompanionMemory()` : `new Memory({ storage: new LibSQLStore({ id: "companion-memory-storage", url: DB_URL, authToken: DB_TOKEN }), vector: new LibSQLVector({ id: "companion-memory-vector", url: DB_URL, authToken: DB_TOKEN }), embedder: companionEmbeddingModel, options: { lastMessages: 20, semanticRecall: { topK: 4, messageRange: { before: 1, after: 1 }, scope: "resource" }, workingMemory: { enabled: true, scope: "resource", template: COMPANION_WORKING_MEMORY_TEMPLATE }, observationalMemory: { model: companionModel, temporalMarkers: true }, generateTitle: false } })`. **Déviation ids** : `companion-memory-storage`/`companion-memory-vector` (pas `mastra-storage`/`mastra-vector`) pour éviter le clash d'id avec le storage de l'instance Mastra. `getCompanionMemory()` singleton lazy. | ✅ | 2026-09-07 |
| TASK-003 | Exporter `COMPANION_WORKING_MEMORY_TEMPLATE` (markdown) avec les blocs `# Faits`, `# Préférences` (`- documentation-backend:` / `- pret-de-repondre:`), `# Décisions` (`- décision: | contexte: | raison: | alternative:`) et `# Procédures` (`- procédure: | but: | étapes: | échecs:`). | ✅ | 2026-09-07 |
| TASK-004 | Mettre à jour `.env.example` : `OMNIROUTE_EMBEDDING_MODEL=text-embedding-3-small` (commentaire : modèle d'embedding exposé par `{OMNIROUTE_BASE_URL}/embeddings`). Ajouté aussi `TURSO_DATABASE_URL=file:./mastra.db` + `TURSO_AUTH_TOKEN=`. | ✅ | 2026-09-07 |

### Implementation Phase 2

- GOAL-002: Connecter l'agent principal à la mémoire unifiée avec récupération **réelle** (injection dans le prompt) et isolement resource/thread.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Dans `src/mastra/agents/companion/agent.ts:55`, remplacer `memory: new Memory({ options: { generateTitle: false } })` par `getCompanionMemory()` (singleton — même instance pour l'agent et la récupération, plutôt que `buildCompanionMemory()` direct, cf. GUD-002). Retirer l'import direct `@mastra/memory`. Exporter `buildCompanionMemory`/`getCompanionMemory`/`COMPANION_WORKING_MEMORY_TEMPLATE`/`resolveMemoryIds`/`retrieveContext`/`sanitizeForMemory` depuis `companion/index.ts`. | ✅ | 2026-09-07 |
| TASK-006 | Créer `src/mastra/agents/companion/memory-context.ts` : `resolveMemoryIds(meta?): { resourceId; threadId? }` — `resourceId = meta?.resourceId || meta?.userId || "anonymous"` (défaut documenté), `threadId` transmis tel quel. | ✅ | 2026-09-07 |
| TASK-007 | Remplacer `retrieveRelevantMemories` (hooks décoratif console.log) par `retrieveContext(task, ids): Promise<string>` dans `memory-context.ts` : `getCompanionMemory().recall({ threadId, resourceId, vectorSearchString, perPage: 4 })` (pas de `topK` dans cette version de l'API — `perPage` borne le résultat) + `getWorkingMemory`, retourne `## Contexte mémoire\n…` ou `""`. Thread canonique `threadId || resourceId` (l'API exige un `threadId`). Erreurs de récupération silencieuses. | ✅ | 2026-09-07 |
| TASK-008 | Activer `generateWithMemory` (companion/agent.ts) : résolution `resolveMemoryIds`, préfixe du prompt avec `retrieveContext`, `options.memory = { thread: { id: threadId||resourceId, resourceId }, resource: resourceId }` (pipeline natif injecte lastMessages/recall/working memory/observations), garde `sanitizeForMemory` sur le résultat (avertissement si motif secret). Supprimé de ce chemin : `extractTaskMemories`/`extractFactsFromText` (regex). | ✅ | 2026-09-07 |
| TASK-009 | Orchestration : pas de `companion-invoke.ts` ni route `/chat` custom dans le repo — les `/chat` utilisent `chatRoute` natif (passe déjà `threadId`/`resourceId` du body → l'instance mémoire unifiée y injecte le contexte). Point d'orchestration réel : `agent-memory-workflow.ts` `executeTaskStep` basculé sur `generateWithMemory(prompt)` (ids → `anonymous` par défaut, documenté). | ✅ | 2026-09-07 |
| TASK-010 | Supprimer les fonctions mortes : `executeWithMemoryHooks` (aucun appel) et `retrieveRelevantMemories` (remplacé par `retrieveContext`). `memory_hooks` (« retrieve ») réécrit sur `retrieveContext` ; `executeMemoryTask`/`extractFactsFromText` conservés : `executeMemoryTask` est appelé par le tool `memory_hooks` (fait remarqué : la prémisse « aucun appel dans src/ » du plan était fausse) — suppression/reécriture en Phase 3 (TASK-013/014). `rg retrieveRelevantMemories|executeWithMemoryHooks src` → 0. | ✅ | 2026-09-07 |

### Implementation Phase 3

- GOAL-003: Migrer les données custom existantes vers les primitives Mastra et réduire le Memory Agent à des opérations explicites sur la mémoire unifiée.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Créer `scripts/migrate-custom-memory.ts` (node, importe `@libsql/client` et `buildCompanionMemory`) : lit `semantic_memories` (status='active'), `decisions` (status='accepted'), `procedures` depuis le fichier `mastra.db` ; génère les blocs `# Faits` / `# Préférences` (predicate='prefers') / `# Décisions` / `# Procédures` avec provenance `(source: <source_type>)` ; écrit via `updateWorkingMemory` sur resource `anonymous` ; marque chaque ligne `status='superseded'`. Flags CLI : `--dry-run` (affiche sans écrire), `--resource <id>` (défaut `anonymous`). Import de `buildCompanionMemory` retardé (dynamique) pour que `--dry-run` n'exige pas de variables OmniRoute. | ✅ | 2026-09-07 |
| TASK-012 | Placer `COMPANION_WORKING_MEMORY_TEMPLATE` (défini à TASK-003) comme source du bloc de migration : aucune transformation LLM, copie déterministe des champs. | ✅ | 2026-09-07 |
| TASK-013 | Réécrire `src/mastra/agents/memory/tools/` à **3 outils natifs** : `memory_find` (input `{ query, resourceId, limit?, userId?, threadId? }` → `retrieveContext` + `getWorkingMemory`, renvoie `{ context, count, resourceId }`), `memory_store` (input `{ label, content, subject?, resourceId }` → valide label {faits,preferences,decisions,procedures}, **`sanitizeForMemory` rejette les secrets**, upsert de la ligne dans le bloc via `updateWorkingMemory`), `memory_forget` (input `{ label, key?, resourceId }` → efface le bloc étiqueté ou la ligne clé). Supprimé les 17 outils legacy de `tools/index.ts`/`agent.ts` ; `agent.ts` réécrit (3 outils + instructions format `STATUS:`/`SUMMARY:`). `memory_hooks` réécrit (retrieve/store/forget), `src/mastra/tools/index.ts` épuré. **Déviation** : `upsertBlockLine`/`forgetBlock` (helpers purs exportés pour tests). | ✅ | 2026-09-07 |
| TASK-014 | Mettre à jour `src/mastra/agents/memory/delegation.ts` : `buildMemoryDelegationPrompt(task)` ne génère plus de JSON libre — il sélectionne l'outil natif (find/store/forget, via `OPERATION_TO_NATIVE` pour compat des opérations legacy) et demande une réponse **structurée** `STATUS:`/`SUMMARY:` ; `parseMemoryTaskResult` lit ce format (pas de `JSON.parse`). | ✅ | 2026-09-07 |
| TASK-015 | Vérifier l'agent `memory` dans le plan executor : `SPECIALIST_AGENTS.memory` garde `{ agent: memoryAgent, id: "memory" }` ; branche dédiée `runMemoryTask` dans `executeStep` (comme `runResearchTask`) : `inferMemoryOperation` (heuristics find/store/forget), `buildMemoryDelegationPrompt` → `memoryAgent.generate` → `parseMemoryTaskResult` → `mapMemoryResultToReport`. Test`executor-memory.test.ts` (routing + operation + mapping, 8 tests). | ✅ | 2026-09-07 |
| TASK-016 | Ré-implémenter `src/mastra/agents/memory/services/preferences.ts` (`getPreference`/`setPreference`) sur le working memory (bloc `# Préférences`, lignes `- subject: value`), contrat conservé, secrets rejetés. `preferences.test.ts` **réécrit** pour mocker `getCompanionMemory` (5 tests — la version « memory-manager » n'était plus tenable après suppression). | ✅ | 2026-09-07 |
| TASK-017 | Supprimer la surface custom morte après migration : `repositories/**`, `storage/**`, `domain/**`, `hooks/`, `observability/`, services `{conflict,consolidation,decisions,episodes,forget,get,list,memory-manager,procedures,procedures-list,record-decision,record-episode,remember,search,update,verify}` (gardés `preferences.ts` + `index.ts`). `rg memoryManager|MemorySearchInput|extractTaskMemories|executeMemoryTask|recordEpisode src` → 0. **Dépendants réécrits sur natives pour garder le build vert (avancés hors scope plan initial)** : `memory-routes.ts` (search/remember/list/workflow sur natives), `agent-memory-workflow.ts` (`retrieveContext` + `generateWithMemory` + `memoryStoreTool`, suppression de l'étape recordEpisode), `memory-hooks-tool.ts` (actions retrieve/store/forget), `memory/index.ts`, `companion-instructions.ts` (références legacy `memory_remember/memory_verify/memory_record_episode/memory_get_procedure` retirées). | ✅ | 2026-09-07 |

### Implementation Phase 4

- GOAL-004: Automatiser la maintenance et appliquer les correctifs de fond (verify/archive/consolidation obsolètes).

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Créer `src/mastra/workflows/memory-maintenance-workflow.ts` : étape `memory-maintenance` (a) relit le working memory de la resource, (b) fusionne/dedupe les blocs par label via `normalizeWorkingMemory` (helper pur exporté — headings canoniques insensibles à la casse/accents), (c) ré-applique `sanitizeForMemory` (lignes secrets supprimées et comptées), (d) purge les threads vides (aucun message, aucun WM) via `deleteThread` (nettoyage vecteurs). Enregistré dans `src/mastra/index.ts` (workflows + tool `memory_maintenance`). **Déviation** : `memory_workflow` (exécution mémoire-first) est conservé ; un nouveau tool `memory_maintenance` déclenche la maintenance au lieu de réaffecter `memoryWorkflowTool`. | ✅ | 2026-09-07 |
| TASK-019 | Brancher un job quotidien : flush au boot `mastra.schedules.create({ id, workflowId:'memory-maintenance', cron, timezone:'UTC', inputData:{resourceId:'anonymous'} })` si `MEMORY_MAINTENANCE_CRON` est défini (défaut `0 3 * * *` documenté dans `.env.example`), best-effort (try/catch — un collier existant ne fait pas échouer le boot). **Déviation** : via l'API schedules workflows, pas `startScheduleTool` (mécanique agent-prompt exigent threadId/resourceId d'un agent appelant). | ✅ | 2026-09-07 |
| TASK-020 | Corriger/finaliser les sémantiques : `verifyMemory`, `archiveStaleMemories`, `consolidateEpisodes` supprimés (déjà effacés en Phase 3) ; `rg verifyMemory|archiveStaleMemories|consolidateEpisodes|memory_conflicts src` → 0. La ligne de provenance `(source: <source_type>)` est stockée dans chaque bloc par le script de migration (TASK-011), pas de table `memory_conflicts`. | ✅ | 2026-09-07 |
| TASK-021 | Ré-implementer `src/mastra/routes/memory-routes.ts` (fait en avance en Phase 3) : `/memory/search` → `memory_find` (recall + WM), `/memory/list` → `getWorkingMemory`, `/memory/remember` → `memory_store` (label via body), chemins HTTP et enveloppe `{ results }`/`{ memories }` conservés (compat CON-003). | ✅ | 2026-09-07 |

### Implementation Phase 5

- GOAL-005: Couverture de tests de la mémoire unifiée et validation complète.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Créer `src/mastra/agents/companion/tests/memory-factory.test.ts` : `buildCompanionMemory()` instancie un Memory avec storage id `companion-memory-storage`, vector id `companion-memory-vector` (ids déviés — pas `mastra-storage`/`mastra-vector`, cf. TASK-003), embedder `ModelRouterEmbeddingModel`, et `threadConfig` (accès protégé → cast typé) contenant `semanticRecall {scope:'resource', topK:4}`, `workingMemory.scope==='resource'` + template 4 blocs, `observationalMemory {temporalMarkers:true}` ; `getCompanionMemory()` singleton. | ✅ | 2026-09-07 |
| TASK-023 | Créer `src/mastra/agents/memory/tests/memory-context.test.ts` : `resolveMemoryIds` (fallbacks `userId`, `anonymous`, priorité resourceId), `sanitizeForMemory` rejette `sk-…`/`ghp_…`/`-----BEGIN…` et accepte le texte normal, `retrieveContext` (mock `getCompanionMemory`) retourne `''` sans résultat et est résilient aux erreurs de storage. | ✅ | 2026-09-07 |
| TASK-024 | Créer `src/mastra/agents/memory/tests/delegation.test.ts` : `buildMemoryDelegationPrompt` sélectionne `memory_find`/`memory_store`/`memory_forget` (et mappe `remember` legacy → `memory_store`), ne contient aucune instruction JSON ; `parseMemoryTaskResult` renvoie success/partial/failed structurés (confiance 1/0.6/0) et **échoue en `failed` sur un payload JSON libre**. | ✅ | 2026-09-07 |
| TASK-025 | Créer `src/mastra/agents/memory/tests/tools-native.test.ts` : `memory_find`/`memory_store`/`memory_forget` via faux `getCompanionMemory` (vi.mock ../../companion/memory) — store rejette un secret sans écrire, store upsert la ligne dans le bon bloc, find propage le contexte + count, forget vide le bloc ou une ligne clé en gardant les autres. | ✅ | 2026-09-07 |
| TASK-026 | Mettre à jour `package.json` script `test` : ajouté `src/mastra/agents/companion/tests` (les paths memory/tests + preferences.test.ts déjà ajoutés à la Phase 3) ; scripts de migration non exécutés par vitest (typecheck `scripts/` avec `--types node`). Validé : `npx tsc --noEmit` clean (accès protégés `_storage`/`threadConfig` → casts typés), `npm test` **117/117 (19 fichiers)**, `npm run build` OK. | ✅ | 2026-09-07 |

---

## 3. Alternatives

- **ALT-001**: Étendre le sous-système custom (snapshots/trends/recap/profil + recherche FTS5 — approche de `plan/feature-professional-memory-1.md`) → Rejeté : perpétue deux mémoires déconnectées, recherche keyword fragilie, délégation JSON libre non fiable ; Mastra Memory fournit déjà recall sémantique, working memory et observational memory nativement.
- **ALT-002**: Migrer vers PgStore/PgVector (PostgreSQL managé) pour la production → Rejeté : ajoute une infra et une configuration réseau ; LibSQL (déjà utilisé, fichier unique) suffit pour le volume prévu (ASSUMPTION-002).
- **ALT-003**: Supprimer entièrement l'agent `memory` et déléguer les tâches « enregistrer dans la mémoire » au companion → Rejeté : le plan executor route explicitement par `suggestedAgent`, garder un agent `memory` allégé préserve le contrat du planner sans coût.
- **ALT-004**: Adopter un fournisseur mémoire tiers (mem0, Letta) → Rejeté : dépendance externe, données hors du repo, incompatible avec la contrainte locale (CON-001/CON-002).

---

## 4. Dependencies

- **DEP-001**: `@mastra/memory@1.26.2` — instancié, `Memory` (déjà installé).
- **DEP-002**: `@mastra/libsql@1.20.0` — `LibSQLStore` et `LibSQLVector` (déjà installés, exports vérifiés).
- **DEP-003**: `@mastra/core@1.59.0` — `ModelRouterEmbeddingModel` depuis `@mastra/core/llm` (export vérifié dans `dist/llm/index.d.ts`).
- **DEP-004**: `@ai-sdk/openai-compatible` — méthode `embeddingModel(modelId)` sur le provider OmniRoute (export vérifié).
- **DEP-005**: L'endpoint OmniRoute doit exposer `POST {OMNIROUTE_BASE_URL}/embeddings` avec le modèle `OMNIROUTE_EMBEDDING_MODEL` (à confirmer avant Phase 1).
- **DEP-006**: `resourceId`/`threadId` transmis via les options de génération (`chatRoute`/routes custom) — CON-003, fallback `anonymous`.
- **DEP-007**: `schedule-tools.ts` (start/stopScheduleTool) déjà présent pour le job quotidien TASK-019.

---

## 5. Files

- **FILE-001**: `src/mastra/providers/omniroute.ts` — ajout `companionEmbeddingModel` (TASK-001).
- **FILE-002**: `src/mastra/agents/companion/memory.ts` — fabrique `buildCompanionMemory` + template (nouveau, TASK-002/TASK-003).
- **FILE-003**: `src/mastra/agents/companion/memory-context.ts` — `resolveMemoryIds`, `retrieveContext`, `sanitizeForMemory` (nouveau, TASK-006/007/008).
- **FILE-004**: `src/mastra/agents/companion/agent.ts` — `memory: buildCompanionMemory()` + `generateWithMemory` actif (TASK-005/008).
- **FILE-005**: `src/mastra/agents/companion/index.ts` — exports mémoire (TASK-005).
- **FILE-006**: `.env.example` — `OMNIROUTE_EMBEDDING_MODEL` (TASK-004).
- **FILE-007**: `src/mastra/agents/memory/hooks/index.ts` — `retrieveContext` remplace le hook décoratif, suppression des fonctions mortes (TASK-007/010).
- **FILE-008**: `scripts/migrate-custom-memory.ts` — migration one-shot (nouveau, TASK-011/012).
- **FILE-009**: `src/mastra/agents/memory/tools/` — réduit à `memory_find`, `memory_store`, `memory_forget` (TASK-013).
- **FILE-010**: `src/mastra/agents/memory/delegation.ts` — prompt + parse structurés (TASK-014).
- **FILE-011**: `src/mastra/workflows/plan-executor-workflow.ts` — `SPECIALIST_AGENTS.memory` conservé (TASK-015).
- **FILE-012**: `src/mastra/agents/memory/services/preferences.ts` — ré-implémentation working memory (TASK-016).
- **FILE-013**: `src/mastra/agents/memory/{repositories,storage,services}` — suppression des fichiers custom morts (TASK-017).
- **FILE-014**: `src/mastra/workflows/memory-maintenance-workflow.ts` + `src/mastra/index.ts` + `src/mastra/tools/memory-workflow-tool.ts` — maintenance (TASK-018/019/021).
- **FILE-015**: `src/mastra/routes/memory-routes.ts` — routes sur primitives natives (TASK-021).
- **FILE-016**: `package.json` — script `test` enrichi (TASK-026).

---

## 6. Testing

- **TEST-001**: `buildCompanionMemory` consomme les bonnes instances (storage `mastra-storage`, vector `mastra-vector`, embedder `omniroute/…`) et est un singleton.
- **TEST-002**: `resolveMemoryIds` — `resourceId` prioritaire, fallback `userId`, dernier recours `anonymous`.
- **TEST-003**: `sanitizeForMemory` rejette les motifs secrets (sk-, ghp_, xoxb, AKIA, `-----BEGIN`) et laisse passer le texte normal.
- **TEST-004**: `retrieveContext` retourne la section `## Contexte mémoire` avec les messages `recall` + le working memory, et une section vide sans résultat.
- **TEST-005**: Contrat `delegation` — chaque opération {find, store, forget} produit des inputs conformes aux schémas natifs ; `parseMemoryTaskResult` ne dépend d'aucun JSON libre.
- **TEST-006**: `memory_find`/`memory_store`/`memory_forget` (faux Memory) — store rejette un secret, find propage le contexte, forget vide le bloc.
- **TEST-007**: `preferences.test.ts` existant reste vert sur le working memory.
- **TEST-008**: Le plan executor route une tâche `suggestedAgent:"memory"` vers l'agent `memory` id conservé, avec un résultat structuré.
- **TEST-009**: Migration `--dry-run` produit le mapping attendu (faits/preférences/décisions/procédures → blocs labels) sans écrire en base.
- **TEST-010**: Validation complète : `npx tsc --noEmit` OK, `npm test` (suite entière vert), `npm run build` (mastra build) OK.

---

## 7. Risks & Assumptions

- **RISK-001**: `ModelRouterEmbeddingModel` ne résout pas le provider `omniroute` hors contexte Mastra → **Mitigation** : si test infructueux à TASK-002, implémenter un `EmbeddingModel` custom appelant `POST {OMNIROUTE_BASE_URL}/embeddings` (CON-001), garder `companionEmbeddingModel` comme interface.
- **RISK-002**: L'endpoint OmniRoute ne propose pas de `/embeddings` → **Mitigation** : dégrader le semantic recall (option `semanticRecall: false`, `recall` en pagination/date) sans bloquer le reste ; documenter dans `.env.example`.
- **RISK-003**: Observational memory utilise par défaut `google/gemini-2.5-flash` (injoignable ici) → **Mitigation** : configurer explicitement `observationalMemory.model = companionModel` (TASK-002).
- **RISK-004**: La migration de lignes en texte libre vers des blocs perd de la fidélité → **Mitigation** : mapping déterministe champ-à-champ (TASK-012), `--dry-run` contrôlable, provenance conservée.
- **RISK-005**: Régression d'isolation resource/thread (fuite de contexte entre ressources) → **Mitigation** : tous les accès exigent `resourceId` (SEC-002), tests TEST-002/TEST-004.
- **ASSUMPTION-001**: L'endpoint OmniRoute expose bien `POST /embeddings` pour un modèle d'embedding.
- **ASSUMPTION-002**: Le volume mémoire tient dans le fichier LibSQL local (projets suivis < 50, historique borné par observational memory).
- **ASSUMPTION-003**: Le `chatRoute` fournit un `resourceId`/`userId` ; sinon tout tombe sur `anonymous` (documenté, pas bloquant).
- **ASSUMPTION-004**: L'utilisateur accepte de relancer l'agent une fois pour que les messages existants soient ré-embarqués dans le vector store de semantic recall.

---

## 8. Related Specifications / Further Reading

- [Mastra llms.txt](https://mastra.ai/llms.txt) (source de référence des APIs)
- [Mastra Memory overview](https://mastra.ai/docs/memory/overview) (docs embarquées : `node_modules/@mastra/memory/dist/docs/references/docs-memory-overview.md`)
- [Semantic recall](https://mastra.ai/docs/memory/semantic-recall) (`semanticRecall`, `recall({ threadId, resourceId, vectorSearchString })`)
- [Working memory](https://mastra.ai/docs/memory/working-memory) (`workingMemory.scope='resource'`, `getWorkingMemory`/`updateWorkingMemory`)
- [Observational memory](https://mastra.ai/docs/memory/observational-memory) (Observer/Reflector, `observationalMemory.model`)
- [Memory class reference](https://mastra.ai/reference/memory/memory-class) (constructor params vérifiés dans `reference-memory-memory-class.md`)
- `plan/feature-professional-memory-1.md` — **remplacé** par ce plan (status à repasser à `Deprecated`)