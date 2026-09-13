# Architecture — Runtime de conversations

Objectif : les conversations sont des runtimes **persistants**, **indépendants** et
**découplés de la visibilité**. Naviguer hors de `/agent` ne détruit ni n'interrompt un tour ;
chaque conversation stream, stoppe, accumule un draft et mémorise son statut de façon isolée.

Trois couches, trois responsabilités distinctes :

```
Visibilité (React Router / /agent)          ← seule chose que la navigation change
    │ lit / écrit
Runtime application (Zustand: chat-runtime)  ← drafts, statut, erreurs, abort, approbations
    │ écrit pendant les streams (module-scope)
Cache serveur (TanStack Query)               ← messages + activité, source de "ce qui est en cours"
    │ source de vérité
Backend (Mastra, localhost:4111)             ← threads, messages, activité, outils
```

## 1. Pourquoi pas de re-création de librairies

- **TanStack Query** gère : déduplication, `staleTime`, stockage en cache mémoire par clé,
  refetch arrière-plan, mutations optimistes. Interdire du cache fait main.
- **Zustand** gère : état runtime hors React avec sélecteurs + persistance localStorage.
- **Dexie / IndexedDB : non installé.** Les messages sont déjà persistés par le backend
  (source de vérité) ; le cache Query couvre la session ; IndexedDB dupliquerait des données
  serveur sans valeur ajoutée. Les drafts, seuls besoins de survie au reload, vivent en
  localStorage via `zustand/middleware.persist` (`partialize`: drafts + conversation active).

## 2. Clés de cache (TanStack Query)

| Clé | Contenu | staleTime |
|---|---|---|
| `["conversations", workspaceId]` | liste des threads | 30 s |
| `["conversation", conversationId]` | messages (type UI `Message[]`) | 60 s |
| `["conversation", conversationId, "activity"]` | log d'activité | 15 s |
| `["tools", workspaceId]` | inventaire MCP/plugins | 60 s |

- `refetchOnMount` par défaut : retour rapide = zéro requête si frais ; retour tardif = cache
  affiché immédiatement + refetch arrière-plan (`isFetching` sans `isPending` → indicateur
  « Syncing… »). Jamais d'écran bloquant.
- Un stream écrit **dans le cache** via `queryClient.setQueryData` sur la même clé que le query
  hook : le composant ré-affiche en direct, sans provoquer de refetch concurrent.

## 3. Store runtime (Zustand, par conversation)

État **application** uniquement (le serveur reste la source pour messages/activité) :

- `activeConversationId` — conversation visible (persistée)
- `drafts[id]` — composer par conversation (persisté, survit au reload)
- `status[id]` — `idle | streaming | error` ; `sending[id]` — verrou d'envoi
- `abortControllers[id]` — **un** controller par conversation : `stop A` n'aborte jamais B
- `activeMessageIds[id]` — message assistant en cours de stream
- `pendingApprovals[id]` — approbations d'outils en attente
- `errors[id]`, `creationError`

Persistance : `name: "compagnon.chat-runtime"`, `partialize` = `activeConversationId` + `drafts`
(un stream ne survit pas à un reload, donc locks/controllers/messageIds restent mémoire).

## 4. Ordonnancement des streams (module-scope)

`use-chat.ts` orchestre hors du composant : `runTurn`, `runApproval`, `mirrorActivity`,
`appendToAssistant`, `finalizeTurn`, `finishIfIdle`. Les écritures vont uniquement vers les
singletons module (`queryClient` + `useChatRuntime`) → un tour continue après l'unmount de la
page ; le composant re-lit les mêmes singletons à son remount. Fin de tour suspendue tant qu'une
approbation est en attente (`finishIfIdle`). Erreur = état terminal `error` (sending/abort
nettoyés, `errors[id]` rempli) — plus de retour silencieux à `idle`.

## 5. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/query/queryClient.ts` | `QueryClient` singleton + défauts |
| `src/hooks/chat/use-conversation-queries.ts` | hooks queries/mutations + clés |
| `src/store/chat-runtime.ts` | runtime Zustand par conversation (persist) |
| `src/hooks/chat/use-chat.ts` | adaptateur : store + cache, orchestration streams |
| `src/pages/Agent.tsx` | draft du store (plus de `useState` local) |
| `src/components/chat/conversation-bar.tsx` | switch autorisé pendant un stream |
| `src/main.tsx` | `QueryClientProvider` |
| `src/lib/conversations.ts` | `setActiveConversationId` synchronise le store |

## 6. Tests

`use-chat.test.tsx` (pilot adapté : `QueryClientProvider` + resets store/cache/LS par test),
`use-chat-runtime.test.tsx` (T2-T4, T6, T8), `use-chat-cache.test.tsx` (T1, T5, T7, fake timers
pour la staleness). 17 tests verts, `typecheck`/`build` sans erreur. Endpoints backend → 200.