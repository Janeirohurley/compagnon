---
name: workspace-isolation
description: >-
  Implémente ou maintient l'architecture "workspaces" de Compagnon : isolation par tenant workspaceId (alias resourceId) des données (mémoire, conversations, connexions) et du runtime (agents actifs, sous-agents, tools/MCP, racines fichiers) et de la config (modèle, instructions). Use when the user asks to work on workspaces, tenant isolation, multi-workspace ("isolation des agents", "workspace", "work in workspace", "agents actifs par espace de travail", "isoler la mémoire par workspace"). Follows plan/architecture-workspace-isolation-1.md.
---

# Workspace Isolation (architecture Compagnon)

Skill d'exécution de `plan/architecture-workspace-isolation-1.md`. Transforme le schéma implicite `resourceId` de Compagnon en vrais workspaces (tenant = données + runtime + config indépendants), **sans** nouvelle base ni multi-instance Mastra.

## Concept clé

**`workspaceId` === `resourceId`** : on ne renomme aucune colonne ni clé Mastra. `resourceId` reste la clé de tenancy déjà gérée par le framework (`MASTRA_RESOURCE_ID_KEY`, scopes `"resource"` du `Memory`), et `workspaceId` en est la valeur côté application. Toute résolution passe par le module `src/mastra/workspaces/`.

## Règles non-négociables

1. **Charger le skill `mastra` avant tout travail Mastra** (reglè AGENTS.md) et vérifier les APIs dans `node_modules/@mastra/*/dist/docs` — ne jamais coder de mémoire.
2. **Toute entrée de workspace passe par la résolution unique** (`src/mastra/workspaces/resolve.ts`, TASK-003) : `x-workspace-id` (header) > `workspaceId` (body/query) > `"default"`. Rien d'autre. Aucun `process.env` lu pour résoudre un workspace ailleurs que dans ce module.
3. **Les agents sont construits par fabriques** (`createXAgent(cfg)`), jamais de singleton nouveau. L'accès se fait via `getWorkspaceRuntime(workspaceId)` (`src/mastra/workspaces/runtime.ts`) avec cache `Map` + `dropWorkspaceRuntime(id)` invalidation propre.
4. **MCP résolu lazy par workspace** : interdiction d'ajouter un nouveau top-level `await getMcpToolsForAgent(...)` du style `agents/companion/agent.ts:25`. La liste des serveurs MCP est filtrée par `cfg.enabledAgents` (ex. `notion` indisponible si `notion` n'est pas actif).
5. **Outils fichiers à la racine du workspace** : remplacer tout `findProjectRoot()` (cwd) par `cfg.projectPath`, en gardant la garde `projectPath()` (blocage `..`) intacte.
6. **Cron/maintenance itère les workspaces** : jamais de `resourceId` hardcodé (`index.ts:109`).
7. **Rétrocompat** : `"default"` bootstrappé idempotent ; codes et routes inchangés (ajout de `workspaceId` seulement). Phases à livrer dans l'ordre : P1 données → P2 runtime/agents actifs → P3 config + UI.

## Cycle d'exécution (par phase du plan)

1. Lire `plan/architecture-workspace-isolation-1.md` (GOAL/TASK de la phase concernée) et le code actuel cité (fichiers de la section 5).
2. Login stubs → implémenter les TASK de la phase dans l'ordre des numéros ; chaque TASK renvoie au nom de fichier exact et à la ligne de départ citée dans le plan.
3. Valider APRÈS chaque phase (jamais une seule à la fin) :
   - `npx tsc --noEmit`
   - `npm test`  (garder les 119 verts — bascule singletons→runtime testée à TASK-015/016)
   - `npm run build` (backend et `compagnon-ui` pour la Phase 3)
4. Réaliser les tests d'isolation du plan (TEST-001 à TEST-008) avant de déclarer la phase terminée.

## Pièges connus

- **Casse des tests** à la Phase 2 : garder les exports singletons comme instance du workspace `"default"` (CON-004) jusqu'à TASK-015, puis retirer et corriger les imports.
- **Caches MCP globaux** (`notion/mcp-tools.ts`) : invalider via `dropWorkspaceRuntime` à la création/modification d'un workspace.
- **Concurrence `mastra.db`** : pas de verrou à ajouter — le tenancy est déjà par clé ; ne pas « optimiser » prématurément en séparant les bases (ALT-001 est écarté sauf exigence de séparation physique).
- **UI** : ne JAMAIS omettre `workspaceId`/`x-workspace-id` dans `compagnon-ui/src/lib/api.ts` — le middleware chuterait sur `"default"` silencieusement.

## Livrable attendu

À la fin : un workspace peut être créé/sélectionné (UI), chaque workspace a sa mémoire, ses conversations et connexions isolées, ses agents actifs, sa racine fichiers et (optionnellement) son modèle/instructions — le tout sans changer la base ni l'API HTTP (ajout de `workspaceId` seulement).

Références : plans du dossier `plan/` (notamment `refactor-memory-mastra-unification-1.md` qui a posé les scopes `"resource"`), `MASTRA_DOCS.md`, `MEMORY_SYSTEM.md`, `AGENTS.md`.