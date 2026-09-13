---
goal: Migrer la navigation du frontend Compagnon de react-router-dom vers @tanstack/react-router et rendre la position workspace/projet/session 100% URL-based (/agent/workspace/:w/projet/:p/session/:s), sans auto-scroll au fetch des messages.
version: 1.0
date_created: 2026-09-12
owner: user / assistant
status: 'Done'
tags: ['router', 'migration', 'url-state', 'tanstack-router', 'frontend']
---

# Introduction

![Status: Done](https://img.shields.io/badge/status-Done-green)

Le frontend utilise react-router-dom (Route `/agent` unique, position workspace/session stockée en localStorage + store Zustand). Objectif : (1) gérer **toute** la navigation avec @tanstack/react-router, (2) rendre la position exacte dérivée de l'URL — `http://localhost:5173/agent/workspace/:workspaceId/projet/:projectId/session/:sessionId` — avec `__all__` réservé pour le chat workspace-global (projectId null), (3) supprimer l'auto-scroll au fetch des messages (suivi du stream seulement, collé au bas après un envoi). Le draft par conversation reste persisté (Zustand/localStorage) car c'est de l'état de frappe, pas de la localisation.

## 1. Requirements & Constraints

- **REQ-001**: Migrer toutes les pages (Dashboard, Projects, Tasks, Agent, Agents, Memory, Activity, Tools, Workflows, Missions, Profile, Providers) vers @tanstack/react-router ; supprimer react-router-dom du package.json.
- **REQ-002**: La position agent est dérivée de l'URL `/agent/workspace/:workspaceId/projet/:projectId/session/:sessionId`. `projectId === "__all__"` = chat workspace-global (conversations à projectId null). Pas d'état interne/localStorage pour savoir "où on est" côté agent.
- **REQ-003**: Une nouvelle session se **crée puis on navigue** vers son URL réelle (jamais d'id fictif dans l'URL). 'New chat' et 'Start session' (Projects) suivent ce flow.
- **REQ-004**: `/agent` sans paramètre → redirection (`replace`) vers la dernière position connue (localStorage) ou vers `__all__` + session vide (la page crée alors le fallback puis navigue).
- **REQ-005**: Scroll : aucun auto-scroll à l'ouverture/fetch des messages ; pendant un stream, suivre seulement si proche du bas ; après un envoi, aller en bas.
- **CON-001**: Le runtime conversation (streams module-scope, cache TanStack Query, store Zustand) créé lors du chantier feature-conversation-runtime-1 est conservé ; l'URL remplace la *sélection* (activeConversationId) mais pas l'orchestration ni les drafts.
- **CON-002**: Backend inchangé (aucune route nouvelle) ; le filtre projet se fait côté client depuis la liste workspace (`listConversations`).
- **CON-003**: Les pages hors `/agent` continuent de lire le workspace actif via `getActiveWorkspaceId()` (localStorage), inchangé.
- **GUD-001**: Router code-based (pas de file-based routing plugin) ; routes paresseuses (`lazyRouteComponent`) par page.
- **GUD-002**: TypeScript strict, pas de `any` ; conventions feature-first existantes ; rapports en français, chaînes UI en anglais.
- **PAT-001**: Maintenir la séparation requête/runtime : aucune donnée serveur ne rentre dans l'URL (seuls des identifiants) ; aucune donnée de runtime (drafts/statuts) ne sort dans l'URL.

## 2. Implementation Steps

### Implementation Phase 1 — Infrastructure routeur TanStack

- GOAL-001: Installer @tanstack/react-router et mettre en place le routeur code-based remplaçant react-router-dom pour toutes les pages.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | `npm remove react-router-dom` puis `npm install @tanstack/react-router` (répertoire `/home/projets/ai/compagnon-ui`). | ✔ | 2026-09-12 |
| TASK-002 | Créer `src/router.tsx` : `createRootRoute` avec layout `AppShell` + `<Outlet/>` ; routes `getParentRoute`/`createRoute` code-based pour : `/`, `/projects`, `/projects/$id`, `/tasks`, `/tasks/$id`, `/agents`, `/memory`, `/activity`, `/tools`, `/workflows`, `/missions`, `/providers`, `/profile` (toutes `lazyRouteComponent`), plus l'arbre agent du Phase 2. `createRouter({ routeTree })`, exporter `router`. | ✔ | 2026-09-12 |
| TASK-003 | `src/main.tsx` : remplacer `BrowserRouter` par `<RouterProvider router={router}/>` (dans `QueryClientProvider`) ; supprimer l'import react-router-dom. | ✔ | 2026-09-12 |
| TASK-004 | Supprimer `src/App.tsx` (routes migrées dans `router.tsx`) ; ajuster les imports qui en dépendent. | ✔ | 2026-09-12 |
| TASK-005 | Remplacer les usages react-router : `AppShell.tsx` (`Link` → tanstack `Link`, `useLocation` → tanstack), `CommandPalette.tsx` (`useNavigate` → `useRouter().navigate`), `project-card.tsx`/`project-detail.tsx`/`workspace-section.tsx`, `Dashboard.tsx`, `Activity.tsx`, `Profile.tsx`, `Tasks.tsx`, `Workflows.tsx` (`Link`/`useParams` → tanstack). `useParams` tanstack : `useParams({ from: "/projects/$id" })` ou `useMatch` ; pour `/tasks/$id`. | ✔ | 2026-09-12 |
| TASK-006 | Vérifier `npm run typecheck` propre après Phase 1 (corriger les typedefs, pas de `any`). | ✔ | 2026-09-12 |

### Implementation Phase 2 — URL-scoped agent (workspace/projet/session)

- GOAL-002: Rendre la position agent (workspace + projet + session) dérivée de l'URL avec flux create-then-navigate.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-007 | `src/lib/conversations.ts` : ajouter `getActiveProjectId()`/`setActiveProjectId(id)` (localStorage `compagnon.activeProject`) et `resolveAgentLocation()` retournant `{ workspaceId, projectId, sessionId }` depuis localStorage (défauts : workspace par défaut, `__all__`, session `""`). `setActiveConversationId` continue de synchroniser le store. | ✔ | 2026-09-12 |
| TASK-008 | `src/router.tsx` : routes agent — `/agent` → composant `AgentBootstrap` (lazy) qui appelle `resolveAgentLocation()` puis `router.navigate({ to: "/agent/workspace/$workspaceId/projet/$projectId/session/$sessionId", params, replace: true })` ; route profonde `/agent/workspace/$workspaceId/projet/$projectId/session/$sessionId` → page `Agent` (lazy). | ✔ | 2026-09-12 |
| TASK-009 | `src/hooks/chat/use-chat.ts` : nouvelle signature `useChat({ workspaceId, projectId, conversationId })` ; la sélection s'appuie sur `conversationId` (param URL) au lieu de `store.activeConversationId` ; lorsqu'il est vide/null : reprise liste[0] du contexte projet, sinon création fallback (`ensureAutoConversation` scoped workspace+projet, `projectId` réel si ≠ `__all__`) ; exposer `conversationId` effectif + `createdConversationId` (pour navigation). `handleSend`/`decideApproval`/`runTurn` utilisent `workspaceId`/`projectId` passés. Les queries messages/activité restent keyées `conversationId`. | ✔ | 2026-09-12 |
| TASK-010 | `src/pages/Agent.tsx` : lire `workspaceId`/`projectId`/`sessionId` via `useParams` tanstack ; passer à `useChat` ; `useEffect` sur `createdConversationId` → navigate `replace` vers l'URL de la nouvelle session + `setActiveConversationId(id)`/`setActiveProjectId`/`setActiveWorkspaceId` pour la persistance de fallback. `ConversationBar` filtrée sur le contexte projet (`projectId ==="__all__"` ⇒ `projectId null`) ; `onSelect` = `navigate` (replace, param session) ; `createNewConversation` = création puis navigate vers son URL ; suppression inchangée (guards streaming). | ✔ | 2026-09-12 |
| TASK-011 | `src/hooks/projects/use-projects.ts` : `startSession` navigue vers `/agent/workspace/$workspaceId/projet/$projectId/session/$sessionId` (params depuis projet + nouvelle conversation) ; `useNavigate` → `useRouter().navigate`. | ✔ | 2026-09-12 |
| TASK-012 | `AppShell.tsx` : au switch de workspace, si la page courante est l'arbre `/agent/...`, `navigate` vers la même position avec le nouveau `workspaceId` (params projet/session conservés) ; sinon `setActiveWorkspaceId` comme aujourd'hui. `compagnon:workspace-changed` conservé pour les autres pages. | ✔ | 2026-09-12 |

### Implementation Phase 3 — Scroll : suivi de stream seulement

- GOAL-003: Supprimer l'auto-scroll au fetch des messages ; suivre le stream uniquement si collé au bas ; aller en bas à l'envoi.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | `src/pages/Agent.tsx` : `useEffect [conversationId]` → `stickToBottomRef.current = false` (pas de saut à l'ouverture/fetch) ; dans `send()` → `stickToBottomRef.current = true` + `bottomRef.current?.scrollIntoView` avant/après `handleSend` ; conserver l'effet scroll `[messages]` ne tirant que si `stickToBottomRef.current` et l'`onScroll` (proche du bas ⇒ true). | ✔ | 2026-09-12 |
| TASK-014 | Supprimer `behavior: "smooth"` du scroll de suivi de stream (remplacé par un défilement direct pour suivre le rythme sans lag) ; garder smooth pour le saut à l'envoi. | ✔ | 2026-09-12 |

### Implementation Phase 4 — Tests, vérification, doc

- GOAL-004: Adapter les tests à la nouvelle signature, tester URL/redirection/scroll, préserver les T1-T8 du runtime.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Adapter `use-chat.test.tsx`, `use-chat-runtime.test.tsx`, `use-chat-cache.test.tsx` : `useChat({ workspaceId: "default", projectId: "__all__", conversationId })` ; le pilot passe un `conversationId` explicite (examples `c1`) ; garder le cas auto-create (conversationId `""`). | ✔ | 2026-09-12 |
| TASK-016 | Nouveau `src/router.test.tsx` : rendu `RouterProvider` → `AgentBootstrap` redirige vers l'URL canonique (mock `resolveAgentLocation`) ; la route profonde rend `Agent` ; `/projects/$id` → component `Projects` (params). Mock des modules API. | ✔ | 2026-09-12 |
| TASK-017 | T-scroll : après chargement initial des messages → `stickToBottom` reste false (aucun scroll) ; après envoi → bottom appelé ; pendant stream près du bas → suivi ; scroll up → arrêt du suivi (via spy sur `HTMLDivElement.prototype.scrollIntoView`). | ✔ | 2026-09-12 |
| TASK-018 | `npm run typecheck`, `npm run build`, `npm test` (tous verts) ; smoke curl ces endpoints inchangés (`/workspaces`, `/conversations`, `/conversations/*/messages`, `/conversations/*/activity`, `/projects` → 200) ; `mastra dev` backend + page `/agent/workspace/default/projet/__all__/session/<id>` servie. | ✔ | 2026-09-12 |
| TASK-019 | Mettre plan à `Done` ; rédiger `docs/architecture-routing-url.md` (URL = localisation, cache = serveur, store = runtime, matrice des routes TanStack, flux create-then-navigate, règle de scroll). | ✔ | 2026-09-12 |

## 3. Alternatives

- **ALT-001**: Garder react-router-dom pour les pages hors agent et ne migrer que `/agent`. Écarté : deux routeurs + double source de vérité de navigation ; dégradation du pixi demandé ("même les navigation d'une app soient gérées par tanstack").
- **ALT-002**: Segment `/projet` optionnel pour le chat global au lieu de `__all__`. Écarté : routes imbriquées conditionnelles complexes ; la valeur réservée garde UNE forme d'URL simple et un filtre client unique.
- **ALT-003**: URL `session/new` puis remplacement par l'id réel. Écarté (décision utilisateur) : la création précède la navigation ; l'URL ne contient jamais d'id fictif.
- **ALT-004**: Filtrage serveur des conversations par projet (`GET /conversations?projectId=`). Retenu côté client (CON-002) pour ce chantier afin de garder le backend iso-fonctionnel ; un TASK ultérieur peut le server-side en mutation fonctionnelle.

## 4. Dependencies

- **DEP-001**: `@tanstack/react-router` (dernière version stable, compatible React 19) — remplace react-router-dom.
- **DEP-002**: `@tanstack/react-query` et `zustand` déjà en place (runtime + cache du chantier feature-conversation-runtime-1) ; aucune nouvelle lib.
- **DEP-003**: Backend Mastra sur `localhost:4111` non modifié (listes/messages/activité en lecture seule pour ce chantier).

## 5. Files

- **FILE-001**: `src/router.tsx` (nouveau) — root route + layout AppShell, routes code-based lazy, agent tree.
- **FILE-002**: `src/main.tsx` — `RouterProvider` remplace `BrowserRouter`.
- **FILE-003**: `src/App.tsx` — supprimé (routes migrées).
- **FILE-004**: `src/components/layout/AppShell.tsx` — Link/useLocation tanstack, switch workspace → navigate agent, restant inchangé.
- **FILE-005**: `src/components/CommandPalette.tsx`, `src/pages/{Dashboard,Activity,Profile,Tasks,Workflows,Projects}.tsx`, `src/components/projects/{project-card,project-detail,workspace-section}.tsx` — imports react-router → tanstack.
- **FILE-006**: `src/hooks/projects/use-projects.ts` — `startSession` → navigate URL agent.
- **FILE-007**: `src/lib/conversations.ts` — helpers projet + `resolveAgentLocation()`.
- **FILE-008**: `src/hooks/chat/use-chat.ts` — signature `{workspaceId, projectId, conversationId}`.
- **FILE-009**: `src/pages/Agent.tsx` — params URL, create-then-navigate, scroll stream-only.
- **FILE-010**: `src/hooks/chat/use-chat.test.tsx`, `use-chat-runtime.test.tsx`, `use-chat-cache.test.tsx` — adaptés.
- **FILE-011**: `src/router.test.tsx` (nouveau), `src/scroll-behavior.test.tsx` (nouveau).
- **FILE-012**: `docs/architecture-routing-url.md`, `plan/refactor-router-1.md` — doc + plan.
- **FILE-013**: `package.json` — dep routing.

## 6. Testing

- **TEST-001**: Bootstrap : `/agent` → `replace` vers `/agent/workspace/{w}/projet/{p}/session/{s}` (canonique depuis localStorage).
- **TEST-002**: Route profonde : `/agent/workspace/default/projet/__all__/session/c1` → `Agent` rend avec c1 ; messages/activity keyed c1.
- **TEST-003**: Switch de conversation = navigate `replace` (URL mise à jour, pas de store-active).
- **TEST-004**: New chat (contexte projet) → conversation créée avec `projectId` réel puis URL `/session/{id}`.
- **TEST-005**: T1-T8 runtime/cache conservés (17 tests verts) avec nouvelle signature.
- **TEST-006**: Scroll : pas de scroll après fetch initial ; suivi de stream près du bas ; saut à l'envoi ; arrêt si scroll up (spy `scrollIntoView`).

## 7. Risks & Assumptions

- **RISK-001**: Changement de signature `useChat` casse les 3 fichiers de test existants → géré par TASK-015 (adaptation + vérification `npm test`).
- **RISK-002**: `useParams`/`useLocation` tanstack changent de forme (sans mutations directes) → TASK-005 couvre chaque fichier ; typecheck comme garde-fou.
- **RISK-003**: La redirection `/agent` dépend du localStorage (REQ-004) ; si vide, fallback `__all__` + session vide auto-créée (comportement actuel conservé).
- **RISK-004**: La double navigation (Bootstrap puis création fallback) peut flasher une URL vide → navigation `replace` + `createdConversationId` au niveau page, sans remount de l'orchestration (module-scope).
- **ASSUMPTION-001**: La liste des conversations reste scoped workspace côté backend ; le filtre projet est effectué côté client (déjà le cas dans `use-projects.ts`).
- **ASSUMPTION-002**: Aucune donnée serveur dans l'URL — uniquement workspaceId/projectId/sessionId (identifiants).

## 8. Related Specifications / Further Reading

- `plan/feature-conversation-runtime-1.md` — runtime + cache récents (conservés, la sélection passe à l'URL).
- `plan/architecture-frontend-ui-1.md` — architecture feature-first du frontend.
- `docs/architecture-conversation-runtime.md` — couches runtime/cache/persistance du chat.
- TanStack Router : https://tanstack.com/router/latest/docs/framework/react/overview