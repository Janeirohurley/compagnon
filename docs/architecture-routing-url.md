# Architecture — Navigation & URL-scoped agent

Objectif : la position de l'agent est **dérivée de l'URL** — workspace + projet + session.
L'URL est la seule localisation ; le serveur reste la source des listes/messages/activité ;
le store Zustand ne porte que l'état runtime (drafts, statuts, streams). Plus aucune
navigation gérée par react-router-dom.

```
URL (TanStack Router)                          ← où on est (workspace/projet/session)
    │ lit les paramètres
Runtime application (Zustand: chat-runtime)     ← drafts, statut, erreurs, abort, approbations
Cache serveur (TanStack Query)                 ← messages + activité + conversations
    │ source de vérité
Backend (Mastra, localhost:4111)               ← threads, messages, activité, outils
```

## 1. Principes

- **URL = localisation, jamais données.** L'URL ne contient que des identifiants
  (`workspaceId`, `projectId`, `sessionId`) ; aucune donnée serveur ni runtime n'y entre.
- **Serveur = source de vérité du contenu** (conversations, messages, activité, outils) via
  TanStack Query ; l'état local associé à une conversation (draft, statut de tour) vit dans
  le store runtime, pas dans l'URL.
- **Une conversation = une URL.** Ouvrir une conversation = navigation (`replace`) vers son
  URL canonique ; jamais d'id fictif dans le navigateur (`session/new` etc.).
- **`__all__` est une valeur réservée.** Projet `__all__` = chat workspace-global : filtre
  client sur les conversations à `projectId === null`. Tout autre `projectId` confine l'agent
  aux conversations du projet (filtre côté client à partir de la liste workspace, backend
  inchangé).

## 2. Matrice des routes (TanStack Router, code-based)

| Route | Composant | Rôle |
|---|---|---|
| `/` | `Dashboard` (lazy) | tableau de bord |
| `/projects`, `/projects/$id` | `Projects` (lazy) | liste / détail projet (même composant, `id` via `useMatch` optionnel) |
| `/tasks`, `/tasks/$id` | `Tasks` (lazy) | liste / détail tâche |
| `/agents`, `/memory`, `/activity`, `/tools`, `/workflows`, `/missions`, `/providers`, `/profile` | pages (lazy) | pages statiques |
| `/agent` | `AgentBootstrap` | résout la dernière position (localStorage) puis `replace` vers l'URL canonique |
| `/agent/workspace/$workspaceId/projet/$projectId/session/$sessionId` | `Agent` | page de chat : params URL → `useChat({workspaceId, projectId, conversationId})` |

Root route = layout `AppShell` + `<Outlet/>`. Toutes les routes pairs/hors-agent sont en
`lazyRouteComponent` (code-splitting par page). `main.tsx` monte `<RouterProvider>` dans les
providers React Query/theme.

## 3. Flux create-then-navigate

1. **Bootstrap** — entrée sur `/agent` : `resolveAgentLocation()` lit
   `compagnon.activeWorkspace` / `compagnon.activeProject` / conversation active (store persisté)
   puis `router.navigate({ replace: true })` vers l'URL canonique.
2. **URL sans `sessionId`** (ex. clic « Agent » alors que la position persistée a expiré) :
   le hook `useChat` résout `conversationId` = première conversation du contexte projet ; si le
   contexte est vide, `ensureAutoConversation(workspaceId, projectId réel?)` crée un fallback.
   La page constate `conversationId !== sessionId` et navigue `replace` vers l'URL de la
   session réelle.
3. **Nouvelle conversation** — `createNewConversation()` crée d'abord (POST `/conversations`),
   puis `openConversation(id)` navigue vers `/agent/workspace/{w}/projet/{p}/session/{id}`. La
   barre de conversations est filtrée sur le `projectId` du contexte URL.
4. **Start session (page Projects)** — `startSession(project)` : création + `setActiveProjectId`
   + navigate vers l'URL agent complète du projet.

À chaque navigation sur un nouveau session/workspace/projet, `setActiveWorkspaceId` /
`setActiveProjectId` / `setActiveConversationId` resynchronisent les valeurs persistées de
fallback (utilisées uniquement par le bootstrap `/agent`). La page ne fait jamais confiance à
ces valeurs pour savoir où elle est — seule l'URL compte.

## 4. Règle de scroll (suivi du stream, pas du fetch)

- **Ouverture / fetch de conversation : aucun scroll.** `stickToBottomRef` repart à `false` à
  chaque changement de `sessionId`.
- **Pendant un stream :** l'effet `[messages]` scroll vers le bas **seulement si**
  `stickToBottomRef.current`, mis à jour par l'`onScroll` de la zone de messages (proche du bas,
  marge 120 px ⇒ `true`) ; scroll direct (sans `smooth`) pour suivre le rythme sans lag.
- **Après un envoi :** `send()` passe `stickToBottomRef = true` puis `scrollIntoView({behavior:
  "smooth"})` à la résolution du tour — collé au bas même si l'utilisateur était remonté.

## 5. Choix techniques notables

- `useParams({ from, shouldThrow: false })` renvoie `undefined` (et non `{}`) quand la route
  ciblée n'est pas dans les matches actifs : les composants partagés (list/détail `Projects`,
  `Tasks`, `Agent`) lisent donc les params via `useMatch({ from, shouldThrow: false, select })`
  et gardent le cas `undefined`.
- `Link` typé TanStack exige des params explicites pour les routes `$id` :
  `<Link to="/projects/$id" params={{ id }}>` (les templates `/projects/${id}` ne passent pas
  le typer strict).
- Hors de l'arbre `/agent`, le workspace reste lu via `getActiveWorkspaceId()` (localStorage) —
  ces pages ne sont pas URL-scoped. Le switch de workspace depuis `/agent` navigue vers
  `/agent` (le bootstrap re-résout la nouvelle position).

## 6. Fichiers

- `src/router.tsx` — root route (AppShell + Outlet), routes lazy, agent tree, `declare module`.
- `src/pages/AgentBootstrap.tsx` — résolution + `replace` vers l'URL canonique.
- `src/lib/conversations.ts` — `ALL_PROJECTS`, `get/setActiveProjectId`, `resolveAgentLocation`.
- `src/hooks/chat/use-chat.ts` — signature `{workspaceId, projectId, conversationId}`.
- `src/pages/Agent.tsx` — params URL, create-then-navigate, reset scroll à l'ouverture.
- `src/hooks/projects/use-projects.ts` — `startSession` → navigate URL agent.
- `src/components/layout/AppShell.tsx` — switch workspace compatible `/agent`.
- `src/main.tsx` — `RouterProvider` (remplace `BrowserRouter`) ; `src/App.tsx` supprimé.

Détail du flux conversation : `docs/architecture-conversation-runtime.md`.