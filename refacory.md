Prompt — Refactor Compagnon vers une architecture modulaire par Sub-Agent

Tu dois refactoriser et structurer l'architecture de Compagnon afin que chaque Sub-Agent soit un module autonome, isolé et facilement détachable.

L'objectif n'est pas simplement de déplacer quelques fichiers.

L'objectif est d'établir une architecture dans laquelle chaque agent possède dans son propre dossier tout ce qui est nécessaire à son fonctionnement : agent, prompt, tools, logique métier, types, storage adapters si nécessaire, tests et documentation.

L'architecture doit être pensée pour permettre d'ajouter ou retirer un Sub-Agent sans créer de dépendances croisées difficiles à maintenir.

1. Principe architectural fondamental

Adopte une architecture self-contained / vertical slice par agent.

Chaque Sub-Agent doit être considéré comme un module indépendant.

Par exemple :

agents/
└── memory/
    ├── agent.ts
    ├── prompt.ts
    ├── tools/
    ├── domain/
    ├── services/
    ├── repositories/
    ├── storage/
    ├── tests/
    └── README.md

Le Memory Agent ne doit donc pas dépendre d'une structure globale comme :

src/tools/memory/
src/memory/
src/tests/memory/

avec ses composants dispersés.

Tout ce qui est spécifiquement nécessaire au Memory Agent doit être regroupé dans son module.

2. Architecture cible

La structure globale doit évoluer vers :

├── .agents/
│       │       │   ├── search.ts
│       │       │   ├── remember.ts
│       │       │   ├── get.ts
│       │       │   ├── list.ts
│       │       │   ├── update.ts
│       │       │   ├── forget.ts
│       │       │   ├── retrieve-context.ts
│       │       │   ├── record-episode.ts
│       │       │   ├── record-decision.ts
│       │       │   ├── get-procedure.ts
│       │       │   ├── update-procedure.ts
│       │       │   ├── verify.ts
│       │       │   ├── extract-facts.ts
│       │       │   ├── consolidate.ts
│       │       │   ├── find-stale.ts
│       │       │   ├── archive-stale.ts
│       │       │   └── index.ts
│       │       │
│       │       ├── domain/
│       │       │   ├── types.ts
│       │       │   ├── schemas.ts
│       │       │   ├── enums.ts
│       │       │   └── errors.ts
│       │       │
│       │       ├── services/
│       │       │   ├── memory-manager.ts
│       │       │   ├── retrieval.ts
│       │       │   ├── validation.ts
│       │       │   ├── conflict.ts
│       │       │   ├── lifecycle.ts
│       │       │   └── consolidation.ts
│       │       │
│       │       ├── repositories/
│       │       │   ├── memory-repository.ts
│       │       │   ├── episode-repository.ts
│       │       │   ├── decision-repository.ts
│       │       │   ├── procedure-repository.ts
│       │       │   └── conflict-repository.ts
│       │       │
│       │       ├── storage/
│       │       │   ├── client.ts
│       │       │   ├── schema.ts
│       │       │   └── migrations/
│       │       │
│       │       ├── observability/
│       │       │   ├── logger.ts
│       │       │   └── metrics.ts
│       │       │
│       │       ├── hooks/
│       │       │   └── index.ts
│       │       │
│       │       ├── tests/
│       │       │   ├── agent.test.ts
│       │       │   ├── retrieval.test.ts
│       │       │   ├── conflict.test.ts
│       │       │   ├── consolidation.test.ts
│       │       │   ├── lifecycle.test.ts
│       │       │   └── tools.test.ts
│       │       │
│       │       ├── README.md
│       │       └── index.ts
│       │
│       ├── connections/
│       ├── config/
│       ├── instructions/
│       ├── mcp/
│       ├── models/
│       ├── routes/
│       ├── workflows/
│       └── index.ts
│
├── docs/
│   └── agents/
│       └── memory/
│           ├── architecture.md
│           ├── memory-model.md
│           ├── retrieval.md
│           ├── lifecycle.md
│           └── agent-contract.md
│
├── .env.example
├── AGENTS.md
├── CHANGELOG.md
├── MEMORY_SYSTEM.md
├── README.md
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.json

Cette structure est la direction architecturale souhaitée.

Ne crée cependant pas artificiellement des fichiers qui ne sont pas nécessaires. Si un composant n'a pas encore besoin d'un fichier séparé, garde-le simple.

3. Règle essentielle : ownership

Chaque agent possède ses composants.

Pour le Memory Agent :

agents/memory/

est le propriétaire de :

agent
prompt
instructions
tools
domain
services
repositories
storage
observability
hooks
tests
documentation

Il ne faut pas avoir :

src/tools/memory/

ou :

src/memory/

pour contenir une deuxième partie du Memory Agent.

Le système de mémoire doit être localisé dans :

src/mastra/agents/memory/
4. Les tools appartiennent à leur agent

C'est une règle importante.

Ne fais pas :

src/mastra/tools/
├── memory/
├── plane/
├── github/
├── shell/
└── ...

pour les tools qui appartiennent directement à des Sub-Agents.

Pour le Memory Agent :

agents/memory/tools/

Pour un futur GitHub Agent :

agents/github/tools/

Pour un futur DevOps Agent :

agents/devops/tools/

Pour un futur Research Agent :

agents/research/tools/

Ainsi :

agents/
├── memory/
│   └── tools/
│
├── github/
│   └── tools/
│
├── devops/
│   └── tools/
│
└── research/
    └── tools/

Chaque agent possède son environnement opérationnel.

5. Les composants partagés

Il faut néanmoins éviter de dupliquer les infrastructures réellement communes.

Un composant peut être placé dans une zone partagée uniquement lorsqu'il est :

utilisé par plusieurs agents ;
indépendant du domaine spécifique d'un agent ;
suffisamment stable ;
réellement générique.

Par exemple :

src/mastra/
├── shared/
│   ├── types/
│   ├── errors/
│   ├── logging/
│   ├── utils/
│   └── contracts/

Mais ne mets pas automatiquement tout dans shared.

La règle doit être :

Local par défaut. Shared uniquement lorsque le partage est démontré.

6. Le Main Agent

Le Main Agent est différent des Sub-Agents.

Il est l'orchestrateur.

agents/companion/
├── agent.ts
├── prompt.ts
├── delegation.ts
└── index.ts

Il doit principalement :

comprendre la demande ;
déterminer l'objectif ;
récupérer le contexte nécessaire ;
décider si un Sub-Agent est nécessaire ;
déléguer ;
recevoir les résultats ;
vérifier la cohérence globale ;
poursuivre le workflow ;
produire la réponse finale.

Il ne doit pas contenir la logique interne du Memory Agent.

Il ne doit pas connaître :

MemoryRepository
MemoryLifecycle
MemoryConsolidation
MemoryConflictResolver

Il doit seulement connaître le contrat du Memory Agent.

7. Contrat entre agents

Les agents doivent communiquer via des contrats structurés.

Par exemple :

interface AgentTask {
  id: string;
  objective: string;
  context?: unknown;
  constraints?: string[];
  expectedOutput?: string;
}

Et :

interface AgentResult {
  taskId: string;
  status: "success" | "partial" | "failed" | "blocked";
  summary: string;
  data?: unknown;
  warnings?: string[];
  confidence?: number;
}

Chaque agent peut ensuite définir son contrat spécialisé.

Par exemple :

agents/memory/
└── domain/
    └── contracts.ts

Le Main Agent ne doit pas connaître les détails internes du Memory Agent.

8. Le Memory Agent doit être détachable

Une exigence importante est la suivante :

Si demain nous supprimons :

src/mastra/agents/memory/

nous devons pouvoir retirer le Memory Agent avec un nombre limité de modifications explicites :

Main Agent
    ↓
remove Memory Agent registration
    ↓
remove delegation capability

Nous ne devons pas avoir :

30 fichiers
    ↓
imports vers memory/
    ↓
database references
    ↓
tools references
    ↓
hooks references
    ↓
broken architecture

L'objectif est donc de minimiser les dépendances sortantes.

9. Dépendances autorisées

Le Memory Agent peut dépendre de :

shared infrastructure
Mastra primitives
database driver
embedding provider
logging infrastructure
configuration

Mais les autres agents ne doivent pas importer directement :

MemoryRepository
MemoryManager
MemoryLifecycle
MemoryConflictResolver

Ils doivent passer par le contrat du Memory Agent ou les interfaces publiques exposées par son index.ts.

10. API publique du module

Chaque Sub-Agent doit avoir un point d'entrée clair :

agents/memory/index.ts

Ce fichier expose uniquement les éléments nécessaires à l'extérieur.

Par exemple :

export {
  memoryAgent,
} from "./agent";


export {
  createMemoryAgent,
} from "./agent";


export type {
  MemoryTask,
  MemoryTaskResult,
} from "./domain/contracts";

Les détails internes ne doivent pas être exportés inutilement.

11. Ne pas mélanger Skill et Agent

Conserve :

.agents/skills/

comme système de connaissances/instructions.

Un Skill n'est pas un Sub-Agent.

Donc :

.agents/skills/knowledge-memory/

reste un Skill.

Et :

src/mastra/agents/memory/

est le Memory Agent.

Le Skill explique des règles, connaissances ou procédures destinées au système agentique.

Le Sub-Agent fournit une capacité autonome d'exécution.

12. Migration depuis l'architecture actuelle

Le repository possède actuellement notamment :

src/mastra/agents/memory-agent.ts


src/mastra/memory/
├── db/
├── hooks/
├── manager/
├── tools/
├── types/
├── consolidation.ts
└── observability.ts


src/mastra/tools/
├── ...

Ne supprime rien immédiatement.

Commence par identifier les responsabilités de chaque fichier.

Construis ensuite une matrice :

Current file
    ↓
New owner
    ↓
Reason
    ↓
Dependencies

Puis déplace progressivement les composants.

Exemple :

src/mastra/agents/memory-agent.ts
        ↓
src/mastra/agents/memory/agent.ts

et :

src/mastra/memory/types/
        ↓
src/mastra/agents/memory/domain/

et :

src/mastra/memory/manager/
        ↓
src/mastra/agents/memory/services/

et :

src/mastra/memory/tools/
        ↓
src/mastra/agents/memory/tools/

Ne change pas simultanément le comportement métier et l'architecture sans nécessité.

13. Ne pas créer de doublons

Avant de créer un nouveau composant, vérifie si une implémentation existe déjà.

Par exemple, si :

src/mastra/memory/consolidation.ts

existe déjà et fonctionne, déplace-le ou refactorise-le.

Ne crée pas :

agents/memory/services/consolidation.ts

tout en laissant l'ancien actif.

À la fin, il doit exister une seule source de vérité.

14. Tests

Les tests spécifiques au Memory Agent doivent être colocated avec le module :

agents/memory/tests/

Exemple :

agents/memory/tests/
├── agent.test.ts
├── retrieval.test.ts
├── conflict.test.ts
├── lifecycle.test.ts
├── consolidation.test.ts
└── tools.test.ts

L'objectif est que le Memory Agent puisse être testé presque indépendamment du reste de Compagnon.

Les tests d'intégration globaux peuvent rester dans une zone de tests globale si nécessaire.

15. Documentation

La documentation spécifique au Memory Agent doit être proche de l'agent :

agents/memory/README.md

Elle doit expliquer :

rôle ;
responsabilités ;
architecture interne ;
tools ;
contrats ;
dépendances ;
stockage ;
règles de mémoire ;
intégration avec Main Agent ;
comment tester l'agent.

Les documents architecturaux plus importants peuvent également être conservés dans :

docs/agents/memory/

Ne duplique pas inutilement la documentation.

16. Futurs Sub-Agents

Cette architecture doit permettre d'ajouter progressivement :

agents/
├── companion/
├── memory/
├── planner/
├── coding/
├── verification/
├── devops/
├── github/
├── research/
└── security/

Et chacun doit suivre le même pattern :

agents/<agent>/
├── agent.ts
├── prompt.ts
├── instructions.ts
├── tools/
├── domain/
├── services/
├── repositories/
├── storage/
├── observability/
├── tests/
├── README.md
└── index.ts

Tous les agents n'auront pas forcément tous ces dossiers.

Le pattern est une convention architecturale, pas une obligation de créer des fichiers inutiles.

17. Règle de simplicité

Ne sur-architecture pas.

Utilise une couche uniquement lorsqu'elle possède une responsabilité réelle.

Par exemple, si un agent n'a pas de repository, ne crée pas :

repositories/

simplement parce que le pattern l'indique.

Le but est :

autonomie
+
cohésion
+
faible couplage
+
testabilité
+
détachabilité

et non un nombre maximal de dossiers.

18. Critères de réussite

La refactorisation est considérée comme réussie lorsque :

A. Le Memory Agent est autonome
agents/memory/

contient tout ce qui lui est spécifique.

B. Ses tools sont locaux
agents/memory/tools/
C. Sa logique métier est locale
agents/memory/domain/
agents/memory/services/
D. Son stockage spécifique est local
agents/memory/storage/
E. Ses tests sont locaux
agents/memory/tests/
F. Son contrat public est clairement défini
agents/memory/index.ts
G. Le Main Agent ne dépend pas de ses détails internes

Il utilise uniquement le contrat public.

H. Aucun doublon d'implémentation n'existe
I. Les tests existants continuent de fonctionner
J. Le Memory Agent peut être supprimé avec un impact limité et identifiable.
19. Important : ne pas implémenter les autres agents

Cette tâche concerne uniquement la refonte architecturale et l'intégration propre du Memory Agent.

Ne crée pas encore :

planner/
coding/
verification/
devops/
github/
research/
security/

Nous les ajouterons progressivement après validation du Memory Agent.

20. Résultat attendu

À la fin, Compagnon doit avoir cette philosophie architecturale :

                         COMPAGNON
                     Main Orchestrator
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
           MEMORY        PLANNER        CODING
           AGENT          AGENT          AGENT
              │
       ┌──────┴────────────────────┐
       │                            │
       ▼                            ▼
    tools                         domain
       │                            │
       ▼                            ▼
   services                    repositories
       │                            │
       └────────────┬───────────────┘
                    ▼
                 storage

Mais chaque agent est encapsulé :

agents/memory/
    ├── agent
    ├── prompt
    ├── tools
    ├── domain
    ├── services
    ├── repositories
    ├── storage
    ├── tests
    └── documentation

Le principe directeur est :

Un Sub-Agent doit être une unité fonctionnelle autonome, cohérente, testable et détachable.

Avant toute modification, analyse la structure existante et les dépendances. Ensuite effectue la migration progressivement, en conservant le comportement actuel du système et en exécutant les tests après chaque étape significative.

Ne considère pas simplement que le travail est terminé parce que les fichiers ont été déplacés. Vérifie les imports, les dépendances, les exports, l'enregistrement Mastra, les tools, les tests et le fonctionnement réel du Main Agent → Memory Agent.