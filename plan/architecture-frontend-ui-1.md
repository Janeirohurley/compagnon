---
goal: Décomposer la page chat monolithique (Agent.tsx ~977 lignes) et structurer le frontend feature-first : composants par domaine, hooks d'orchestration, API client par domaine — sans changement de comportement visible, puis généraliser le pattern aux autres pages.
version: 1.0
date_created: 2026-09-12
owner: user / assistant
status: 'Done'
tags: ['architecture', 'frontend', 'ui', 'refactor']
---

# Introduction

![Status: Done](https://img.shields.io/badge/status-Done-green)

Le frontend (`/home/projets/ai/compagnon-ui`) est constitué de pages monolithiques :
`pages/Agent.tsx` (977 lignes), `pages/Projects.tsx` (969), `lib/data.ts` (1317
lignes de mocks), `lib/api.ts` (669). Les composants métier ne sont pas extraits :
tout l'état (mémoire, streaming, approbations, activité) et tout le rendu des
bulles / steps / panneaux vitent dans une seule page. Ce plan décompose le chat
d'abord (la page la plus volumineuse et la plus active), met en place une
arborescence feature-first reproductible, découpe l'API client par domaine, puis
applique le même pattern à `Projects.tsx`. Chaque phase est livrable
indépendamment et laisse `npm run typecheck` + `npm run build` verts.

## 1. Requirements & Constraints

- **REQ-001**: Parité de comportement stricte — chaque extraction déplace du JSX / de l'état sans rien changer d'observable (aucune régression de flux SSE, d'approbations, d'activity ou de localStorage).
- **REQ-002**: `pages/Agent.tsx` doit finir sous 250 lignes : uniquement de la composition (barre de conversation, liste de messages, approbations, composer, panneau droit, orchestration via hook).
- **REQ-003**: Aucun composant de `components/chat/` ne fait de réseau, de local Storage ou d'`AbortController` : il reçoit tout par props (PAT-001).
- **REQ-004**: Après le split de l'API, tous les imports `@/lib/api` (module unique) sont migrés vers les modules par domaine ; le fichier `lib/api.ts` d'origine et l'éventuel shim `lib/api/index.ts` sont supprimés.
- **REQ-005**: Les pages hors chat ne changent de source de données que si une source réelle existe déjà (ex. `listTools` pour l'onglet Tools) ; sinon elles gardent le mock documenté (CON-002).
- **SEC-001**: Aucun nouvel endpoint backend ; seule la projection existante `GET /tools` est réutilisée pour remplacer le mock Tools. Rien de nouveau n'expose de secrets.
- **CON-001**: Les primitives shadcn/ui restent dans `components/ui/` et `components/tool-ui/` ne bouge pas (l'approval-card y reste ; seul son wrapper se déplace).
- **CON-002**: `App.tsx`, routes et noms de pages inchangés (le rendu des pages reste sous `pages/`, alimenté par des hooks).
- **CON-003**: Nommage des fichiers en kebab-case (cohérent avec `chat-composer.tsx`, `approval-card.tsx`).
- **CON-004**: Pas de commentaire sauf pour les invariants non évidents (convention repo).
- **CON-005**: Aucune nouvelle dépendance de production ; seule l'ajout de vitest + Testing Library en devDependencies est autorisé (DEP-001).
- **GUD-001**: Arborescence feature-first : `pages/` minces, `components/<feature>/` pour le rendu métier, `hooks/<feature>/` pour l'orchestration, `lib/api/<domaine>.ts` pour le réseau.
- **GUD-002**: Une seule source de vérité par domaine : une page ne construit jamais ses propres clients ou headers (réutilise `lib/api/client.ts`).
- **GUD-003**: Validation déterministe à chaque phase : UI `npm run typecheck` + `npm run build` ; backend `npx tsc --noEmit` + `npm test` (doit rester à 29 fichiers / 188 tests).
- **PAT-001**: Les composants de rendu sont purs : props uniquement, pas d'effets réseau, pas de référence à `document` / `localStorage` excepté les interactions UI triviales disposées dans `components/ui`.
- **PAT-002**: Toute l'orchestration du chat vitent dans `hooks/chat/use-chat.ts` (refs strict-mode compris), pas dans la page.
- **PAT-003**: Chaque module `lib/api/<domaine>.ts` réutilise `client.ts` (`request<T>`, `workspaceHeaders`) et exporte des types typés par domaine.

## 2. Implementation Steps

### Implementation Phase 1 — Extraction des composants de rendu du chat (aucun changement de comportement)

- GOAL-001: Retirer de `pages/Agent.tsx` tout le JSX de rendu dans `components/chat/` sans aucun changement de comportement.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/components/chat/step-list.tsx` : porte le bloc `message.steps` de `AgentMessage` (icônes CheckCircle2/Loader2/Circle, badge tool, `<details>` « raw ») — props `{ steps: AgentStep[] }`. | ✅ | 2026-09-12 |
| TASK-002 | Créer `src/components/chat/message-bubble.tsx` : porte `AgentMessage` (role user/agent, `RenderedMarkdown`, bouton copier, timestamp, avatar) et consomme `StepList` via une prop `steps`. | ✅ | 2026-09-12 |
| TASK-003 | Créer `src/components/chat/activity-feed.tsx` : porte `ActivityFeed` + `ACTIVITY_KIND_CONFIG` + `ACTIVITY_LABEL` (filtres, live badge, auto-scroll, JSON brut) — props `{ events, filter, onFilter, live }`. | ✅ | 2026-09-12 |
| TASK-004 | Créer `src/components/chat/tool-approval-item.tsx` : porte `ToolApprovalCard` de la page + `PendingApproval`, `TOOL_APPROVAL_LABELS`, `approvalMetadata` (wrapper du composant `tool-ui/approval-card`). | ✅ | 2026-09-12 |
| TASK-005 | Créer `src/components/chat/conversation-bar.tsx` : porte la barre horizontale de conversations (boutons initiés, suppression, « New chat ») — props `{ conversations, activeId, disabled, onNew, onSelect, onDelete }`. | ✅ | 2026-09-12 |
| TASK-006 | Créer `src/components/chat/chat-right-panel.tsx` : porte le panneau droit Tabs Context/Tools/Activity — props `{ activity, filter, onFilter, live }`. Les onglets Context/Tools gardent temporairement `AGENT_STATE` / `TOOLS` (remplacés en TASK-022). | ✅ | 2026-09-12 |
| TASK-007 | Créer `src/lib/chat-helpers.ts` : déplace `storedMessageToUi`, `prettyToolName`, types `Message`, `MessageRole`, `AgentStep`, `AgentMessage` helpers. | ✅ | 2026-09-12 |
| TASK-008 | Réécrire `pages/Agent.tsx` : importer les composants extraits, supprimer tout le JSX/helper déplacé ; conserver : status dot, `ChatComposer`, orchestration des messages + streaming + approbations (état inchangé). Vérifier parité (TEST-005). | ✅ | 2026-09-12 |

### Implementation Phase 2 — Hook d'orchestration du chat

- GOAL-002: Transférer l'état et les actions du chat dans `use-chat` et rendre la page purement déclarative.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Créer `src/hooks/chat/use-chat.ts` : porte en bloc l'état (conversations, conversationId, messages, messagesLoading, activity, activityFilter, pendingApprovals, approvalBusy, isStreaming) et toutes les actions/refs (switch/create/remove, handleSend, decideApproval, stopGeneration, trackApproval, handleActivity, endTurn, loaders messages + activity, refs strict-mode `creatingRef`/`activityRef`/`abortRef`…). Signature : `useChat(workspaceId)` — `input` reste UI, confiné dans la page (`handleSend(rawInput)`). | ✅ | 2026-09-12 |
| TASK-010 | Réécrire `pages/Agent.tsx` : consommer `useChat(workspaceId)` ; supprimer de la page tous les useState/useEffect/useRef/actions déplacés. Objectif `< 250 lignes` (REQ-002). | ✅ | 2026-09-12 |

### Implementation Phase 3 — API client par domaine

- GOAL-003: Découper `lib/api.ts` (669 lignes) en modules par domaine sans casser les imports pendant la transition.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Créer `src/lib/api/client.ts` : déplace `API_BASE`, `workspaceHeaders`, `newConversationId`, `newWorkspaceId`, `request<T>`, `JSON_HEADERS`. | ✅ | 2026-09-12 |
| TASK-012 | Créer `src/lib/api/chat.ts` : déplace `ChatMessage`, `StoredMessage`, `ApprovalRequest`, `ActivityEvent`, `ActivityKind`, `ACTIVITY_KIND_BY_TYPE`, `toActivityEvent`, `readSse`, `streamChat`, `approveToolCall`. | ✅ | 2026-09-12 |
| TASK-013 | Créer `src/lib/api/conversations.ts` : déplace `Conversation`, `listConversations`, `createConversation`, `renameConversation`, `deleteConversation`, `getConversationMessages`. `lib/conversations.ts` importe désormais ces fonctions (aliases `apiCreateConversation` etc.) et conserve les helpers localStorage (`getActiveWorkspaceId`, `getActiveConversationId`, `setActiveConversationId`, `fetchConversations`, `createConversation(workspaceId, projectId?)`). | ✅ | 2026-09-12 |
| TASK-014 | Créer `src/lib/api/activity.ts` : déplace `getConversationActivity`. | ✅ | 2026-09-12 |
| TASK-015 | Créer `src/lib/api/providers.ts` : déplace tout le bloc model-providers de `api.ts` (`ProviderKind`, `ProviderCapability`, `ModelProvider`… jusqu'à `probeModelProvider`). | ✅ | 2026-09-12 |
| TASK-016 | Créer `src/lib/api/workspaces.ts` : déplace le bloc workspaces (`Workspace`, `WorkspaceConfig`, `WorkspaceInput`, `listWorkspaces`, `createWorkspace`, …). | ✅ | 2026-09-12 |
| TASK-017 | Créer `src/lib/api/projects.ts` : déplace le bloc projects (`Project`, `ProjectStatus`, `ProjectInput`, `listProjects`, `createProject`, `updateProject`, `deleteProject`). | ✅ | 2026-09-12 |
| TASK-018 | Créer `src/lib/api/tools.ts` : déplace le bloc tools/plugins/MCP (`McpToolServer`, `ToolPlugin`, `ToolsData`, `McpServerInput`, `listTools`, CRUD des serveurs/connections, secrets). | ✅ | 2026-09-12 |
| TASK-019 | Créer `src/lib/api/index.ts` : ré-export temporaire (`export * from "./client"` etc.) pour ne pas rompre les imports existants pendant la migration. | ✅ | 2026-09-12 |
| TASK-020 | Migrer tous les importeurs : `pages/`, `components/`, `hooks/` — remplacer `@/lib/api` par les modules de domaine ciblés (grep `from "@/lib/api"` doit retomber à zéro, hors `@/lib/api/…`). | ✅ | 2026-09-12 |
| TASK-021 | Supprimer `src/lib/api.ts` et le shim `src/lib/api/index.ts` une fois les imports migrés (REQ-004). | ✅ | 2026-09-12 |

### Implementation Phase 4 — Données réelles du chat + documentation d'architecture

- GOAL-004: Éliminer les mocks du chat qui ont une source réelle et documenter l'architecture cible.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-022 | Onglet Tools du `chat-right-panel` : remplacer le mock `TOOLS` par `listTools(workspaceId)` (via un effet dans `use-chat`), garder l'affichage identique ; bloquer le rendu tant que `loading`. Onglet Context : remplacer la liste « Operations today » (mock `ACTIVITY.slice(0,5)`) par le récap réel des `activity` events passés en props. `AGENT_STATE.currentTask`/`currentProject` (sans source) sont retirés du panneau (REQ-005, CON-002). | ✅ | 2026-09-12 |
| TASK-023 | Nettoyer `src/lib/data.ts` : `ACTIVITY`, `AGENT_STATE`, `TOOLS` restent consommés par les pages hors chat (Dashboard, Activity, Tasks, Profile, AppShell…) — non morts ; le chat n'en importe plus rien (vérifié par rg). Le nettoyage réel est différé aux plans de remplacement de ces pages (REQ-005) ; la liste des mocks restants est documentée dans `docs/architecture-frontend.md`. | ✅ | 2026-09-12 |
| TASK-024 | Créer `docs/architecture-frontend.md` (dans `/home/projets/ai/compagnon-ui/docs/`) : arborescence cible, rôles de chaque couche, règles GUD/PAT/CON du présent plan, cookbook « une nouvelle page = hooks + composants purs », convention de tests ui, liste des mocks restants. | ✅ | 2026-09-12 |

### Implementation Phase 5 — Appliquer le pattern à Projects.tsx

- GOAL-005: Décomposer `pages/Projects.tsx` (969 lignes) avec le même découpage que le chat.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-025 | Créer `src/components/projects/project-card.tsx`, `project-list.tsx`, `project-dialog.tsx` (création/édition) : déplacer les blocs de rendu correspondants (carte, liste par workspace avec session Play, modale). | ✅ | 2026-09-12 |
| TASK-026 | Créer `src/hooks/projects/use-projects.ts` : `(workspaceId) => { projects, workspaces, actions: create/update/remove/startSession }`, y compris le wiring « Start session » (createConversation avec projectId + setActiveWorkspaceId/conversationId + navigate). | ✅ | 2026-09-12 |
| TASK-027 | Réécrire `pages/Projects.tsx` : composition via `use-projects` + composants extraits ; supprimer le code déplacé. | ✅ | 2026-09-12 |

## 3. Alternatives

- **ALT-001**: Réécriture complète du front en une passe — rejetée : page chaude, risque de régression global, revue impossible.
- **ALT-002**: Atomic Design (atoms/molecules/organisms) — rejetée : sur-ingénierie pour cette app ; le découpage par domaine métier se lit mieux.
- **ALT-003**: Garder les pages « grosses » et ne découper que l'API — rejetée : le problème de testabilité/duplication de rendu persiste.
- **ALT-004**: Remplacer la page `Activity.tsx` (mock global) par du réel maintenant — rejetée : l'activité réelle est déjà servie par le panneau par conversation ; la page globale reste mock, documentée (REQ-005).

## 4. Dependencies

- **DEP-001**: devDependencies `compagnon-ui` : `vitest` ^5, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event` ; script `"test": "vitest run"` ; config `test` dans `vite.config.ts` (environment jsdom, setupFiles `src/test/setup.ts`) — installé ✅ | ✅ | 2026-09-12 |
- **DEP-002**: Aucune nouvelle dépendance de production (`react-router-dom`, `lucide-react`, shadcn déjà présents).
- **DEP-003**: `lib/conversations.ts` (helpers localStorage + composition) conservé tel quel pendant le split API pour ne pas toucher `Agent.tsx`, `Projects.tsx` et la palette.
- **DEP-004**: Backend inchangé : le contrat SSE (`handleChatStream`) et `GET /conversations/:threadId/activity` sont déjà en place (plan `feature-projects`/`feature-activity` livrés).

## 5. Files

- **FILE-001**: `compagnon-ui/src/pages/Agent.tsx` — réduit à la composition (< 250 lignes).
- **FILE-002**: `compagnon-ui/src/components/chat/message-bubble.tsx` — nouveau.
- **FILE-003**: `compagnon-ui/src/components/chat/step-list.tsx` — nouveau.
- **FILE-004**: `compagnon-ui/src/components/chat/activity-feed.tsx` — nouveau.
- **FILE-005**: `compagnon-ui/src/components/chat/tool-approval-item.tsx` — nouveau.
- **FILE-006**: `compagnon-ui/src/components/chat/conversation-bar.tsx` — nouveau.
- **FILE-007**: `compagnon-ui/src/components/chat/chat-right-panel.tsx` — nouveau.
- **FILE-008**: `compagnon-ui/src/lib/chat-helpers.ts` — nouveau.
- **FILE-009**: `compagnon-ui/src/hooks/chat/use-chat.ts` — nouveau.
- **FILE-010**: `compagnon-ui/src/lib/api/{client,chat,conversations,activity,providers,workspaces,projects,tools}.ts` — nouveaux.
- **FILE-011**: `compagnon-ui/src/lib/api/index.ts` — shim temporaire, supprimé (TASK-021).
- **FILE-012**: `compagnon-ui/src/lib/api.ts` — supprimé (TASK-021).
- **FILE-013**: `compagnon-ui/src/components/projects/{project-card,project-list,project-dialog}.tsx` + `hooks/projects/use-projects.ts` — nouveaux (Phase 5).
- **FILE-014**: `compagnon-ui/src/lib/data.ts` — nettoyé (MOCK supprimés : `ACTIVITY`, blocs `AGENT_STATE`).
- **FILE-015**: `compagnon-ui/docs/architecture-frontend.md` — nouveau.
- **FILE-016**: `compagnon-ui/package.json` — script `test` + devDeps (DEP-001).

## 6. Testing

- **TEST-001**: Composant `step-list` : rend une étape running/pending/done, badge tool et `<details>` raw (Testing Library). | ✅ `step-list.test.tsx` |
- **TEST-002**: Composant `activity-feed` : filtre par kind, badge « live » pendant le streaming, rend le JSON brut de chaque événement. | ✅ `activity-feed.test.tsx` |
- **TEST-003**: Composant `message-bubble` : rend le markdown agent + les steps, bouton copier présent. | ✅ `message-bubble.test.tsx` |
- **TEST-004**: Hook `use-chat` : smoke via composant pilote — envoi d'un message, `streamChat` mocké (fake SSE), étape tool reçue → `messages`/`activity` mis à jour, fin de turn ; reconnaissance des refs strict-mode (TASK-010). | ✅ `hooks/chat/use-chat.test.tsx` |
- **TEST-005**: Validation manuelle E2E après chaque phase (Phase 1-5) : cote dev (port 4111) — un message affiche les steps live, l'onglet Activity se remplit en live, l'historique persiste après rechargement, les approbations et le bouton stop fonctionnent.
- **TEST-006**: Gates CI : UI `npm run typecheck` + `npm run build` verts après chaque TASK ; backend `npx tsc --noEmit` + `npm test` (29 fichiers / 188 tests) inchangés (GUD-003). | ✅ |

## 7. Risks & Assumptions

- **RISK-001**: Dérive de comportement pendant les extractions (JSX recopié à l'identique, une phase à la fois, smoke manuel TEST-005 après chaque phase, diff minimisé).
- **RISK-002**: `use-chat` peut grossir (≈ 350 lignes à terme) ; si > 400 lignes, on le scinde en `use-conversations` + `use-chat-stream` + `use-activity` (éclatement déféré, non bloquant).
- **RISK-003**: Les effets strict-mode (double-mount) protégés par refs (`creatingRef`, `stickToBottomRef`, `activityRef`) doivent être déplacés tels quels dans le hook — tout réordonnancement peut doubler des requêtes en dev.
- **ASSUMPTION-001**: Aucun changement backend requis ; le contrat SSE et l'endpoint activity sont déjà en place.
- **ASSUMPTION-002**: `tool-ui/approval-card` reste un primitif réutilisable ; seul le wrapper (`tool-approval-item`) se déplace vers `components/chat/`.
- **ASSUMPTION-003**: Les mocks des autres pages (Activity, Dashboard, Memory…) ne sont remplacés qu'à un stade ultérieur, quand une source réelle existe (REQ-005).

## 8. Related Specifications / Further Reading

- [`plan/architecture-workspace-isolation-1.md`](architecture-workspace-isolation-1.md) : isolation par workspace/session projet (les hooks consommeront les mêmes ids).
- [`plan/feature-tools-dynamic-workspace-1.md`](feature-tools-dynamic-workspace-1.md) : exemple de remplacement de mock par une API réelle (pattern à répliquer pour l'onglet Tools).
- [`plan/feature-ui-real-data-1.md`](feature-ui-real-data-1.md) : historique du remplacement des mocks (déprécié, utile pour l'ordre d'exécution des pages).
- Skill `.agents/skills/create-implementation-plan/SKILL.md` : conventions de plans du repo (structure imposée).