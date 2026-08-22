---
goal: "Agent Outline spécialisé pour la gestion de la documentation, wiki, et la base de connaissances du projet"
version: 1.0
date_created: 2026-08-22
last_updated: 2026-08-22
owner: Compagnon
status: 'Planned'
tags: ['agent', 'outline', 'documentation', 'knowledge-base', 'feature']
---

# Outline Agent — Agent Spécialisé Documentation & Base de Connaissances

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

## Introduction

Le Outline Agent est un sous-agent spécialisé du Compagnon, responsable de la gestion de la documentation et de la base de connaissances via Outline : recherche de documentation, création/mise à jour de documents, gestion des collections, et publication de connaissances issues du développement.

Il utilise les outils MCP Outline existants (connexion via `OUTLINE_BASE_URL` + `OUTLINE_API_KEY`) et les skills `outline-knowledge` déjà configurés. Il est conçu pour répondre aux questions du type "où est la doc sur l'auth ?", "publie cette décision dans Outline", "résume la documentation du projet" en interagissant avec le Memory Agent pour le contexte.

---

## 1. Requirements & Constraints

- **REQ-001**: L'agent doit pouvoir rechercher des documents dans Outline
- **REQ-002**: L'agent doit pouvoir lire le contenu de documents
- **REQ-003**: L'agent doit pouvoir créer de nouveaux documents
- **REQ-004**: L'agent doit pouvoir mettre à jour des documents existants
- **REQ-005**: L'agent doit pouvoir lister les collections et leur hiérarchie
- **REQ-006**: L'agent doit pouvoir publier des décisions, procédures, et architecture depuis la Mémoire
- **REQ-007**: L'agent doit pouvoir produire des résumés de documentation
- **REQ-008**: L'agent doit pouvoir croiser la doc Outline avec le contexte mémoire
- **REQ-009**: L'agent doit fonctionner en mode dégradé si Outline n'est pas configuré
- **REQ-010**: L'agent doit respecter les permissions Outline (collections, documents)
- **REQ-011**: L'agent doit pouvoir interroger le Memory Agent pour le contexte
- **REQ-012**: L'agent ne doit jamais exposer les credentials Outline
- **CON-001**: Utiliser les outils MCP Outline existants
- **CON-002**: Ne pas dupliquer le skill `outline-knowledge`
- **CON-003**: L'agent doit être indépendamment testable
- **CON-004**: Suivre l'architecture modulaire existante
- **GUD-001**: Utiliser Zod pour la validation
- **GUD-002**: Enregistrer l'agent dans `src/mastra/index.ts`
- **PAT-001**: Suivre le pattern Agent + Subagent de Mastra

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│              COMPAGNON (Main Agent)              │
│                                                  │
│  "Où est la doc sur l'architecture mémoire ?"  │
│  "Publie la décision Typesense dans Outline"    │
│  "Résume la doc du projet Compagnon"            │
│  "Crée un document pour la procédure de deploy" │
├────────────────┬────────────────────────────────┤
│                │ DÉLÉGATION                      │
│                ▼                                 │
│  ┌─────────────────────────────┐                │
│  │      OUTLINE AGENT          │                │
│  │                             │                │
│  │  responsibilities:          │                │
│  │  - Recherche documentation  │                │
│  │  - Création documents       │                │
│  │  - Mise à jour docs         │                │
│  │  - Publication mémoire      │                │
│  │  - Résumés de doc           │                │
│  │  - Gestion collections      │                │
│  │                             │                │
│  │  tools:                     │                │
│  │  - MCP Outline (existant)   │                │
│  │  - Memory Agent             │                │
│  └──────────┬──────────────────┘                │
│             │                                    │
│  ┌──────────▼──────────────────┐                │
│  │  OUTILS MCP OUTLINE         │                │
│  │                             │                │
│  │  (via MCP Outline server):  │                │
│  │  • documents.list           │                │
│  │  • documents.search         │                │
│  │  • documents.read           │                │
│  │  • documents.create         │                │
│  │  • documents.update         │                │
│  │  • documents.delete         │                │
│  │  • collections.list         │                │
│  │  • collections.create       │                │
│  │  • views.list               │                │
│  │  • comments.create          │                │
│  └─────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Phase 1 — Domain Models

- GOAL-001: Définir les types et contrats de l'Outline Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/mastra/agents/outline/domain/types.ts` — Types: `OutlineOperation`, `DocumentSummary`, `CollectionSummary`, `SearchResult`, `DocumentInput`, `PublicationInput`, `OutlineAgentInput`, `OutlineAgentResult`, `KnowledgeSyncResult` | | |
| TASK-002 | Créer `src/mastra/agents/outline/domain/schemas.ts` — Schémas Zod | | |
| TASK-003 | Créer `src/mastra/agents/outline/domain/contracts.ts` — Contrats de délégation: `OutlineTaskInput`, `OutlineTaskResult` | | |
| TASK-004 | Créer `src/mastra/agents/outline/domain/enums.ts` — Enums: `OutlineOperation` (search, read, create, update, delete, list_collections, list_documents, publish_from_memory, sync_knowledge, generate_summary), `DocumentType`, `CollectionAccess` | | |

**Détail `OutlineAgentInput`:**
```typescript
interface OutlineAgentInput {
  operation: OutlineOperation;
  parameters: {
    query?: string;              // recherche
    documentId?: string;         // document cible
    collectionId?: string;       // collection cible
    title?: string;              // titre document
    content?: string;            // contenu markdown
    markdown?: string;           // contenu markdown (alias)
    parentDocumentId?: string;   // document parent (hiérarchie)
    publishFrom?: 'memory';      // source: mémoire
    memoryType?: 'decision' | 'procedure' | 'episode' | 'semantic';
    memoryId?: string;           // ID mémoire à publier
    tags?: string[];
  };
  context?: string;
  memoryContext?: unknown;
}
```

**Détail `KnowledgeSyncResult`:**
```typescript
interface KnowledgeSyncResult {
  published: number;
  updated: number;
  skipped: number;
  errors: string[];
  documents: DocumentSummary[];
  summary: string;
}
```

### Phase 2 — Instructions & Agent

- GOAL-002: Créer les instructions et l'agent Mastra

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Créer `src/mastra/agents/outline/outline-instructions.ts` — System prompt complet | | |
| TASK-006 | Créer `src/mastra/agents/outline/agent.ts` — Agent Mastra: `outlineAgent` | | |
| TASK-007 | Créer `src/mastra/agents/outline/index.ts` — Entry point | | |

**System Prompt de l'Outline Agent (contenu clé):**
```
You are Compagnon's Outline Agent.

Your role is to manage project documentation and knowledge base via Outline.

CORE RESPONSIBILITIES:
- Search, read, create, and update documents in Outline
- Organize knowledge into collections
- Publish decisions, procedures, and architecture from Memory to Outline
- Generate documentation summaries
- Keep documentation in sync with project reality

PUBLISHING RULES:
- When publishing from Memory, preserve the original context and rationale
- Add metadata: source (memory), date, confidence
- Never publish secrets, credentials, or sensitive data
- Distinguish between draft and published documentation

DOCUMENTATION QUALITY:
- Use clear, structured markdown
- Add headers, code blocks, and examples when useful
- Preserve document hierarchy (collections → documents → child docs)
- Link related documents when relevant

MEMORY INTEGRATION:
- Before creating documentation, check Memory for existing knowledge
- When publishing from Memory, enrich with current context
- After significant documentation changes, suggest storing in Memory

DELEGATION CONTRACT:
Input: { operation, parameters }
Output: { status, result, documents, summary }
```

### Phase 3 — Services

- GOAL-003: Implémenter les services métier

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Créer `src/mastra/agents/outline/services/document-service.ts` — `searchDocuments()`, `getDocument()`, `createDocument()`, `updateDocument()`, `deleteDocument()`, `listDocuments()` | | |
| TASK-009 | Créer `src/mastra/agents/outline/services/collection-service.ts` — `listCollections()`, `getCollection()`, `createCollection()` | | |
| TASK-010 | Créer `src/mastra/agents/outline/services/publish-service.ts` — `publishDecisionFromMemory()`, `publishProcedureFromMemory()`, `publishEpisodeFromMemory()`, `syncKnowledgeToOutline()` | | |
| TASK-011 | Créer `src/mastra/agents/outline/services/summary-service.ts` — `generateDocumentSummary()`, `generateCollectionSummary()`, `generateProjectDocSummary()` | | |
| TASK-012 | Créer `src/mastra/agents/outline/services/search-service.ts` — `searchKnowledge()`, `findRelatedDocuments()`, `searchByCollection()` | | |

### Phase 4 — Tools

- GOAL-004: Créer les outils Mastra exposés

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-013 | Créer `src/mastra/agents/outline/tools/outline-search-tool.ts` — Outil `outline_search`: recherche de documents | | |
| TASK-014 | Créer `src/mastra/agents/outline/tools/outline-document-tool.ts` — Outil `outline_manage_document`: CRUD documents | | |
| TASK-015 | Créer `src/mastra/agents/outline/tools/outline-publish-tool.ts` — Outil `outline_publish_from_memory`: publication depuis la mémoire | | |
| TASK-016 | Créer `src/mastra/agents/outline/tools/outline-summary-tool.ts` — Outil `outline_generate_summary`: résumé de documentation | | |
| TASK-017 | Créer `src/mastra/agents/outline/tools/outline-collection-tool.ts` — Outil `outline_manage_collections`: gestion collections | | |
| TASK-018 | Créer `src/mastra/agents/outline/tools/index.ts` — Export des outils | | |

### Phase 5 — Integration

- GOAL-005: Intégrer l'agent dans l'écosystème

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Mettre à jour `src/mastra/index.ts` — Enregistrer `outlineAgent` | | |
| TASK-020 | Mettre à jour `src/mastra/agents/companion/agent.ts` — Ajouter `outline: outlineAgent` sous-agent | | |
| TASK-021 | Mettre à jour `src/mastra/instructions/companion-instructions.ts` — Instructions délégation Outline | | |
| TASK-022 | Créer `src/mastra/routes/outline-routes.ts` — Routes API `/outline/*` | | |
| TASK-023 | Ajouter les routes Outline dans `src/mastra/index.ts` | | |

### Phase 6 — Tests

- GOAL-006: Valider l'Outline Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Créer `src/mastra/agents/outline/tests/document-service.test.ts` | | |
| TASK-025 | Créer `src/mastra/agents/outline/tests/publish-service.test.ts` | | |
| TASK-026 | Créer `src/mastra/agents/outline/tests/search-service.test.ts` | | |
| TASK-027 | Créer `src/mastra/agents/outline/tests/outline-agent.test.ts` | | |
| TASK-028 | Créer `src/mastra/agents/outline/tests/delegation.test.ts` | | |
| TASK-029 | Exécuter `pnpm build` et corriger les erreurs | | |
| TASK-030 | Créer `src/mastra/agents/outline/README.md` | | |

---

## 4. Alternatives

- **ALT-001**: Utiliser uniquement les MCP Outline sans agent → Rejeté: pas de logique de publication depuis la mémoire, pas de résumés intelligents
- **ALT-002**: Fusionner avec le GitHub Agent → Rejeté: Outline et GitHub ont des modèles très différents (wiki vs code)
- **ALT-003**: Utiliser le Memory Agent pour toute la doc → Rejeté: Outline est un système de documentation à part entière, pas un stockage mémoire

---

## 5. Dependencies

- **DEP-001**: MCP Outline — déjà configuré dans `src/mastra/mcp/outline.ts`
- **DEP-002**: `OUTLINE_BASE_URL`, `OUTLINE_API_KEY` — variables d'environnement
- **DEP-003**: `@mastra/core` — Agent, createTool
- **DEP-004**: `zod` — validation
- **DEP-005**: Memory Agent — pour la publication de connaissances

---

## 6. Files

- **FILE-001**: `src/mastra/agents/outline/domain/types.ts` — Types (nouveau)
- **FILE-002**: `src/mastra/agents/outline/domain/schemas.ts` — Schémas Zod (nouveau)
- **FILE-003**: `src/mastra/agents/outline/domain/contracts.ts` — Contrats (nouveau)
- **FILE-004**: `src/mastra/agents/outline/domain/enums.ts` — Enums (nouveau)
- **FILE-005**: `src/mastra/agents/outline/outline-instructions.ts` — Instructions (nouveau)
- **FILE-006**: `src/mastra/agents/outline/agent.ts` — Agent (nouveau)
- **FILE-007**: `src/mastra/agents/outline/index.ts` — Entry point (nouveau)
- **FILE-008**: `src/mastra/agents/outline/services/document-service.ts` — Service documents (nouveau)
- **FILE-009**: `src/mastra/agents/outline/services/collection-service.ts` — Service collections (nouveau)
- **FILE-010**: `src/mastra/agents/outline/services/publish-service.ts` — Service publication (nouveau)
- **FILE-011**: `src/mastra/agents/outline/services/summary-service.ts` — Service résumés (nouveau)
- **FILE-012**: `src/mastra/agents/outline/services/search-service.ts` — Service recherche (nouveau)
- **FILE-013**: `src/mastra/agents/outline/tools/outline-search-tool.ts` — Outil recherche (nouveau)
- **FILE-014**: `src/mastra/agents/outline/tools/outline-document-tool.ts` — Outil documents (nouveau)
- **FILE-015**: `src/mastra/agents/outline/tools/outline-publish-tool.ts` — Outil publication (nouveau)
- **FILE-016**: `src/mastra/agents/outline/tools/outline-summary-tool.ts` — Outil résumés (nouveau)
- **FILE-017**: `src/mastra/agents/outline/tools/outline-collection-tool.ts` — Outil collections (nouveau)
- **FILE-018**: `src/mastra/agents/outline/tools/index.ts` — Index (nouveau)
- **FILE-019**: `src/mastra/routes/outline-routes.ts` — Routes API (nouveau)
- **FILE-020**: `src/mastra/index.ts` — Registration (modifié)
- **FILE-021**: `src/mastra/agents/companion/agent.ts` — Sous-agent (modifié)
- **FILE-022**: `src/mastra/instructions/companion-instructions.ts` — Instructions (modifié)

---

## 7. Testing

- **TEST-001**: searchDocuments avec query → résultats pertinents
- **TEST-002**: getDocument avec ID existant → contenu retourné
- **TEST-003**: createDocument avec données valides → document créé
- **TEST-004**: updateDocument → contenu mis à jour
- **TEST-005**: publishDecisionFromMemory → décision publiée dans Outline
- **TEST-006**: syncKnowledgeToOutline → connaissances synchronisées
- **TEST-007**: generateDocumentSummary → résumé généré
- **TEST-008**: Outline Agent en mode dégradé → erreur explicite
- **TEST-009**: Compagnon délègue correctement à l'Outline Agent
- **TEST-010**: Outline Agent interroge le Memory Agent

---

## 8. Risks & Assumptions

- **RISK-001**: Outline peut ne pas être configuré → Mitigation: mode dégradé
- **RISK-002**: Les permissions Outline peuvent limiter les opérations → Mitigation: vérifier avant d'agir
- **RISK-003**: Le MCP Outline peut être instable → Mitigation: retry avec backoff
- **ASSUMPTION-001**: `OUTLINE_BASE_URL` et `OUTLINE_API_KEY` sont configurés
- **ASSUMPTION-002**: L'utilisateur a les permissions Outline appropriées
- **ASSUMPTION-003**: Le workspace Outline contient des collections

---

## 9. Workflow Type

```
UTILISATEUR: "Publie la décision sur Typesense dans Outline"

COMPAGNON:
  1. → memory_search(query="Typesense décision")
  2. Trouve: DecisionMemory { title: "Choix Typesense", rationale: "...", ... }
  3. → delegate to outlineAgent({ operation: "publish_from_memory", memoryType: "decision", memoryId: "..." })
  
OUTLINE AGENT:
  1. → memory_get(id="...") — récupère la décision complète
  2. → outline_search(query="search engine") — vérifie si un doc existe déjà
  3. Crée le document dans la collection appropriée
  4. Retourne: { status: "success", document: { id, title, url }, summary: "Publié dans..." }
  
COMPAGNON:
  📄 Document publié dans Outline:
  - Titre: "Décision: Choix de Typesense pour la recherche"
  - Collection: Architecture
  - URL: https://outline.example.com/doc/...
```

---

## 10. Diagramme des Inter-Agent

```
┌──────────────────────────────────────────────────────────┐
│                    ÉCOSYSTÈME COMPAGNON                    │
│                                                            │
│  ┌──────────────────────────────────────────────────┐     │
│  │                 COMPAGNON                         │     │
│  │            (Orchestrateur Central)                │     │
│  └───┬──────┬──────┬──────┬──────┬─────────────────┘     │
│      │      │      │      │      │                        │
│      ▼      ▼      ▼      ▼      ▼                        │
│  ┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐               │
│  │Memory││Planner││GitHub││Plane ││Outline│               │
│  │Agent ││Agent  ││Agent ││Agent ││Agent  │               │
│  └──┬───┘└───────┘└──┬───┘└──┬───┘└──┬───┘               │
│     │                │       │       │                     │
│     │    ┌───────────┘       │       │                     │
│     │    │                   │       │                     │
│     ▼    ▼                   ▼       ▼                     │
│  ┌──────────────────────────────────────────┐             │
│  │         INTERACTIONS                      │             │
│  │                                           │             │
│  │  Memory ← GitHub: "quel repo pour ce     │             │
│  │                     projet ?"             │             │
│  │  Memory ← Plane:  "quel était le contexte│             │
│  │                     de cette tâche ?"     │             │
│  │  Memory ← Outline: "publie cette         │             │
│  │                     décision"             │             │
│  │  Memory → Plane:  "les décisions sont    │             │
│  │                     dans Outline"         │             │
│  │  Memory → GitHub: "les issues sont sur   │             │
│  │                     le repo"              │             │
│  └──────────────────────────────────────────┘             │
└──────────────────────────────────────────────────────────┘
```
