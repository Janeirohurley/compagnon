---
goal: Rendre les conversations persistantes, indépendantes, indépendantes de la visibilité route (navigation ≠ arrêt d'exécution), avec cache serveur TanStack Query, runtime Zustand par conversation, sans régression fonctionnelle.
version: 1.0
date_created: 2026-09-12
owner: user / assistant
status: 'Done'
tags: ['conversations', 'runtime', 'cache', 'frontend', 'react-query', 'zustand']
---

# 1. Audit (Phase 1)

Architecture actuelle observée (repo `/home/projets/ai/compagnon-ui`) :

- Route unique `/agent` (React Router) ; le sélecteur de conversation est le composant
  `ConversationBar` (état interne). Pas de route `/chat/:id`.
- `src/hooks/chat/use-chat.ts` (409 l) détient TOUT l'état conversation en `useState`/`useRef`
  (liste, id actif, messages, streaming, approbations, activité, outils, abort).
- Où les données sont fetchées :
  - `useEffect [workspaceId]` → `fetchConversations` (liste),
  - `useEffect [conversationId]` → `getConversationMessages` (messages),
  - `useEffect [conversationId]` → `getConversationActivity`,
  - `useEffect [workspaceId]` → `listTools`.
- Où vivent les streams : `streamChat`/`approveToolCall` lancés dans `handleSend`/`decideApproval`,
  AbortController dans `abortRef` (réf) ; aucune annulation à l'unmount → le fetch continue côté
  serveur mais les callbacks écrivent dans de l'état React démonté (perdu).
- Draft : `useState("")` dans `Agent.tsx` — perdu à la navigation et même au switch de conversation.
- Causes de remount : navigation hors `/agent` (Router unmount `Agent`).
- Causes de refetch : chaque montage → liste + messages + activité + outils ;
  switch in-page → messages + activité (aucun cache).
- Causes d'annulation stream : `stopGeneration` (abort explicite) ; le switch pendant un stream est
  bloqué par `disabled={isStreaming}` dans la ConversationBar.

Aucune librairie : pas de @tanstack/react-query, pas de zustand, pas de dexie ;
pas d'AI SDK (SSE personnalisé `data: {json}` dans `lib/api/chat.ts`).

# 2. Décision d'architecture (Phase 2-5)

- Serveur = source de vérité (inchangé). Messages persistés par le backend.
- **TanStack Query** (à installer) pour : liste `["conversations", workspaceId]`,
  messages `["conversation", conversationId]`, activité
  `["conversation", conversationId, "activity"]`, outils `["tools", workspaceId]`.
  - `staleTime` réels : liste 30 s, messages 60 s, activité 15 s, outils 60 s.
  - `refetchOnMount` par défaut (true) → retour « rapide » sur A = cache instantané sans requête
    (frais) ; retour après long délai = cache affiché immédiatement + rafraîchissement en arrière-plan.
  - Stream en cours : mutation via `setQueryData` sur la même clé, pas de refetch pendant l'écriture.
  - Mutations create/rename/delete avec invalidation de la liste.
- **Zustand** (à installer) runtime application : `activeConversationId`, drafts, statuts,
  erreurs, AbortControllers, message assistant en cours, approbations — par conversation.
  Persistance localStorage (middleware `persist`, partialize drafts + activeId + status).
- **Dexie : NON installé.** Messages déjà persistés côté serveur (source de vérité) ; le cache Query
  couvre la session ; IndexedDB dupliquerait des réponses serveur sans valeur ajoutée (règle
  « éviter la duplication inutile »). Drafs persistés en localStorage via zustand/persist.
- Le streaming écrit dans le query cache + le store (singletons module), donc il survit à l'unmount
  du composant ; le composant re-lit depuis le store/le cache à son remount.

# 3. Fichiers

| Fichier | Rôle |
|---|---|
| `src/lib/query/queryClient.ts` | QueryClient singleton + défauts (nouveau) |
| `src/hooks/chat/use-conversation-queries.ts` | Hooks query/mutation + clés (nouveau) |
| `src/store/chat-runtime.ts` | Store Zustand runtime par conversation (nouveau) |
| `src/hooks/chat/use-chat.ts` | Adaptateur : lit store+queries, orchestre les streams (réécrit) |
| `src/pages/Agent.tsx` | `input` → draft du store ; switch autorisé pendant stream ; indicateur sync (léger) |
| `src/components/chat/conversation-bar.tsx` | Retirer le `disabled` lié au streaming (switch autorisé) |
| `src/main.tsx` | Ajouter `QueryClientProvider` |
| `src/lib/conversations.ts` | `setActiveConversationId`/`deleteConversation` synchronisent le store |
| `<tests>` | `use-chat.test.tsx` adapté + nouveaux tests (voir §4) |
| `docs/architecture-conversation-runtime.md` | Doc runtime vs cache vs persistence |

# 4. Tests (Phase 6-7) — implémentés

- T1 caching : `src/hooks/chat/use-chat-cache.test.tsx` — quitter/revenir → 1 seul appel
  `getConversationMessages` (frais), rendu cache instantané.
- T2 draft : `src/hooks/chat/use-chat-runtime.test.tsx` — draft par conversation conservé au switch A→B→A.
- T3 stream indépendant : un stream A continue d'écrire dans le query cache quand on passe sur B.
- T4 isolation stop : stop sur B → B idle + `signal.aborted` sur B, A reste `streaming` non aborté.
- T5 navigation : le stream + l'état runtime survivent à l'unmount complet du composant.
- T6 statuts indépendants : c1/c2/c3 `streaming`/`idle`/`error` sans interférence.
- T7 stale : données >60s → rendu immédiat du cache + refetch arrière-plan (fake timers).
- T8 erreur : erreur de stream sur A → `errors[A]`, `status[A]="error"` (état terminal), B intact.

Résultat : 17 tests verts (dont 8 nouveaux), `typecheck` et `build` sans erreur.
Vérification réseau séparée : `/workspaces`, `/tools`, `/conversations`,
`/conversations/*/messages`, `/conversations/*/activity` → HTTP 200.

# 5. Bilan d'implémentation

- `src/hooks/chat/use-chat.ts` réécrit : orchestration module-scope (streams découplés du composant),
  un AbortController par conversation, statut d'erreur terminal (l'ancien `finishIfIdle` ramenait
  `error`→`idle` immédiatement, corrigé). Survey `historyFor` typé `ChatMessage[]`.
- Sélecteur Zustand `pendingApprovals` corrigé : le `?? []` inline créait une nouvelle identité
  d'array par `getSnapshot` → boucle infinie de React 19 (`useSyncExternalStore`).
    → abonnement à la map globale + dérivation en rendu.
- `setActiveConversationId`/`deleteConversation` (lib/conversations) synchronisent le store.
- `QueryClientProvider` monté dans `main.tsx` ; `Agent.tsx` pilote le draft du store ;
  `ConversationBar` autorise le switch pendant un stream (retrait du `disabled`).

Tests du chat : `use-chat.test.tsx` (repris) + `use-chat-runtime.test.tsx` + `use-chat-cache.test.tsx`.
Doc d'architecture : `docs/architecture-conversation-runtime.md`.