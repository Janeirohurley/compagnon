---
goal: "Agent Plane spécialisé pour la gestion de projet, le suivi des work items, cycles, et la synchronisation avec le plan de développement"
version: 1.0
date_created: 2026-08-22
last_updated: 2026-08-22
owner: Compagnon
status: 'Planned'
tags: ['agent', 'plane', 'project-management', 'feature']
---

# Plane Agent — Agent Spécialisé Gestion de Projet

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

## Introduction

Le Plane Agent est un sous-agent spécialisé du Compagnon, responsable de toutes les opérations de gestion de projet via Plane : suivi des work items, gestion des cycles, modules, états, et synchronisation avec l'avancement réel du développement.

Il utilise les outils Plane existants (MCP `@makeplane/plane-mcp-server` + outils natifs `plane-api-tools`) et les connexions Plane déjà configurées. Il est conçu pour répondre aux questions du type "où en est le projet ?", "quelles sont les prochaines tâches ?", "quels blocages ?" en croisant les données Plane avec le contexte mémoire.

---

## 1. Requirements & Constraints

- **REQ-001**: L'agent doit pouvoir lister les projets Plane du workspace
- **REQ-002**: L'agent doit pouvoir lister, créer, mettre à jour les work items (issues)
- **REQ-003**: L'agent doit pouvoir gérer les états (states) des work items
- **REQ-004**: L'agent doit pouvoir consulter et ajouter des commentaires
- **REQ-005**: L'agent doit pouvoir lister les cycles et modules
- **REQ-006**: L'agent doit pouvoir analyser l'avancement d'un projet (DONE vs TODO vs IN_PROGRESS)
- **REQ-007**: L'agent doit pouvoir croiser les données Plane avec le contexte mémoire
- **REQ-008**: L'agent doit pouvoir produire un rapport d'avancement
- **REQ-009**: L'agent doit fonctionner en mode dégradé si Plane n'est pas configuré
- **REQ-010**: L'agent doit respecter les permissions Plane
- **REQ-011**: L'agent doit pouvoir interroger le Memory Agent (ex: "quel était le contexte de cette tâche ?")
- **REQ-012**: L'agent doit pouvoir recommander des actions au Compagnon
- **CON-001**: Utiliser les outils Plane existants (MCP + natifs), pas créer de nouvelle connexion
- **CON-002**: Ne pas dupliquer les skills plane-knowledge existants
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
│  "Où en est le projet Compagnon ?"              │
│  "Quels sont les blocages actuels ?"             │
│  "Crée une tâche pour le fix d'auth"            │
│  "Quel est le prochain cycle ?"                  │
├────────────────┬────────────────────────────────┤
│                │ DÉLÉGATION                      │
│                ▼                                 │
│  ┌─────────────────────────────┐                │
│  │       PLANE AGENT           │                │
│  │                             │                │
│  │  responsibilities:          │                │
│  │  - Suivi avancement         │                │
│  │  - Gestion work items       │                │
│  │  - Analyse blocages         │                │
│  │  - Rapports d'avancement    │                │
│  │  - Synchronisation état     │                │
│  │                             │                │
│  │  tools:                     │                │
│  │  - Plane MCP (existant)     │                │
│  │  - Plane API natifs         │                │
│  │  - Memory Agent             │                │
│  └──────────┬──────────────────┘                │
│             │                                    │
│  ┌──────────▼──────────────────┐                │
│  │  OUTILS DISPONIBLES         │                │
│  │                             │                │
│  │  MCP Plane (via npx):       │                │
│  │  • list_projects            │                │
│  │  • list_issues              │                │
│  │  • get_issue                │                │
│  │  • create_issue             │                │
│  │  • update_issue             │                │
│  │  • list_cycles              │                │
│  │  • list_modules             │                │
│  │                             │                │
│  │  API Natifs (plane-api-     │                │
│  │  tools.ts):                 │                │
│  │  • plane_list_projects      │                │
│  │  • plane_list_states        │                │
│  │  • plane_list_issues        │                │
│  │  • plane_get_issue          │                │
│  │  • plane_search_issues      │                │
│  │  • plane_create_issue       │                │
│  │  • plane_update_issue       │                │
│  │  • plane_list_issue_comments│                │
│  │  • plane_add_issue_comment  │                │
│  └─────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Phase 1 — Domain Models

- GOAL-001: Définir les types et contrats du Plane Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/mastra/agents/plane/domain/types.ts` — Types: `PlaneOperation`, `ProjectSummary`, `WorkItemSummary`, `CycleSummary`, `ModuleSummary`, `AdvancementReport`, `BlockageReport`, `PlaneAgentInput`, `PlaneAgentResult` | | |
| TASK-002 | Créer `src/mastra/agents/plane/domain/schemas.ts` — Schémas Zod pour tous les types | | |
| TASK-003 | Créer `src/mastra/agents/plane/domain/contracts.ts` — Contrats de délégation: `PlaneTaskInput`, `PlaneTaskResult` | | |
| TASK-004 | Créer `src/mastra/agents/plane/domain/enums.ts` — Enums: `PlaneOperation`, `WorkItemState`, `Priority`, `CycleStatus` | | |

**Détail `AdvancementReport`:**
```typescript
interface AdvancementReport {
  project: string;
  projectIdentifier: string;
  generatedAt: string;

  // Overall metrics
  totalWorkItems: number;
  completed: number;
  inProgress: number;
  todo: number;
  backlog: number;
  cancelled: number;
  blocked: number;

  // Progress percentage
  completionRate: number;  // 0-100

  // Cycles
  activeCycle: CycleSummary | null;
  upcomingCycles: CycleSummary[];

  // Modules
  modules: ModuleSummary[];

  // Blockages
  blockages: BlockageReport[];

  // Recent activity
  recentCompletions: WorkItemSummary[];
  recentUpdates: WorkItemSummary[];

  // Recommendations
  recommendations: string[];

  // Memory context (from Memory Agent)
  memoryContext?: {
    decisions?: unknown[];
    episodes?: unknown[];
    warnings?: string[];
  };
}
```

**Détail `BlockageReport`:**
```typescript
interface BlockageReport {
  workItem: WorkItemSummary;
  reason: string;
  blockedSince: string;
  dependencies?: string[];
  suggestedAction: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}
```

### Phase 2 — Instructions & Agent

- GOAL-002: Créer les instructions et l'agent Mastra

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-005 | Créer `src/mastra/agents/plane/plane-instructions.ts` — System prompt: identité, responsabilités, patterns, interaction mémoire, génération de rapports | | |
| TASK-006 | Créer `src/mastra/agents/plane/agent.ts` — Agent Mastra: `planeAgent` avec model, instructions, tools | | |
| TASK-007 | Créer `src/mastra/agents/plane/index.ts` — Entry point | | |

**System Prompt du Plane Agent (contenu clé):**
```
You are Compagnon's Plane Agent.

Your role is to manage project tracking via Plane and provide
advancement insights to the main agent.

CORE RESPONSIBILITIES:
- Track project advancement through Plane work items
- Identify blockages and dependencies
- Generate advancement reports
- Manage work items (CRUD)
- Analyze cycles and modules
- Cross-reference Plane data with Memory Agent context

REPORTING RULES:
- Never invent work item status — always verify via Plane
- Distinguish between "tracked in Plane" and "actually done"
- Report discrepancies between Plane state and observable reality
- Use the Memory Agent for historical context

MEMORY INTEGRATION:
- Before reporting, check Memory Agent for relevant decisions/episodes
- After significant state changes, suggest storing in Memory
- When asked "why is this blocked?", check Memory for context

DELEGATION CONTRACT:
Input: { operation, project, parameters }
Output: { status, result, report, recommendations }
```

### Phase 3 — Services

- GOAL-003: Implémenter les services métier

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-008 | Créer `src/mastra/agents/plane/services/project-service.ts` — `listProjects()`, `getProjectSummary()`, `getProjectById()` | | |
| TASK-009 | Créer `src/mastra/agents/plane/services/work-item-service.ts` — `listWorkItems()`, `getWorkItem()`, `createWorkItem()`, `updateWorkItem()`, `searchWorkItems()` | | |
| TASK-010 | Créer `src/mastra/agents/plane/services/cycle-service.ts` — `listCycles()`, `getActiveCycle()`, `getCycleProgress()` | | |
| TASK-011 | Créer `src/mastra/agents/plane/services/module-service.ts` — `listModules()`, `getModuleProgress()` | | |
| TASK-012 | Créer `src/mastra/agents/plane/services/advancement-service.ts` — `generateAdvancementReport()`, `calculateCompletionRate()`, `detectBlockages()`, `analyzeTrends()` | | |
| TASK-013 | Créer `src/mastra/agents/plane/services/comment-service.ts` — `listComments()`, `addComment()` | | |

### Phase 4 — Tools

- GOAL-004: Créer les outils Mastra exposés

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Créer `src/mastra/agents/plane/tools/plane-advancement-tool.ts` — Outil `plane_get_advancement`: rapport d'avancement complet | | |
| TASK-015 | Créer `src/mastra/agents/plane/tools/plane-workitem-tool.ts` — Outil `plane_manage_workitem`: CRUD work items | | |
| TASK-016 | Créer `src/mastra/agents/plane/tools/plane-blockage-tool.ts` — Outil `plane_detect_blockages`: détection de blocages | | |
| TASK-017 | Créer `src/mastra/agents/plane/tools/plane-report-tool.ts` — Outil `plane_generate_report`: rapport formaté | | |
| TASK-018 | Créer `src/mastra/agents/plane/tools/index.ts` — Export des outils | | |

### Phase 5 — Integration

- GOAL-005: Intégrer l'agent dans l'écosystème

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Mettre à jour `src/mastra/index.ts` — Enregistrer `planeAgent` | | |
| TASK-020 | Mettre à jour `src/mastra/agents/companion/agent.ts` — Ajouter `plane: planeAgent` sous-agent | | |
| TASK-021 | Mettre à jour `src/mastra/instructions/companion-instructions.ts` — Instructions délégation Plane | | |
| TASK-022 | Créer `src/mastra/routes/plane-routes.ts` — Routes API `/plane/*` | | |
| TASK-023 | Ajouter les routes Plane dans `src/mastra/index.ts` | | |

### Phase 6 — Tests

- GOAL-006: Valider le Plane Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Créer `src/mastra/agents/plane/tests/project-service.test.ts` | | |
| TASK-025 | Créer `src/mastra/agents/plane/tests/advancement-service.test.ts` | | |
| TASK-026 | Créer `src/mastra/agents/plane/tests/work-item-service.test.ts` | | |
| TASK-027 | Créer `src/mastra/agents/plane/tests/plane-agent.test.ts` | | |
| TASK-028 | Créer `src/mastra/agents/plane/tests/delegation.test.ts` | | |
| TASK-029 | Exécuter `pnpm build` et corriger les erreurs | | |
| TASK-030 | Créer `src/mastra/agents/plane/README.md` | | |

---

## 4. Alternatives

- **ALT-001**: Utiliser uniquement les outils Plane natifs sans agent → Rejeté: pas de structure de délégation, pas de rapport intelligent
- **ALT-002**: Fusionner avec le GitHub Agent → Rejeté: Plane et GitHub ont des modèles de données et des workflows très différents
- **ALT-003**: Utiliser uniquement le MCP Plane → Rejeté: les outils natifs offrent plus de contrôle et de validation

---

## 5. Dependencies

- **DEP-001**: `@makeplane/plane-mcp-server` — déjà configuré dans `src/mastra/mcp/plane.ts`
- **DEP-002**: `PLANE_API_KEY`, `PLANE_WORKSPACE_SLUG`, `PLANE_BASE_URL` — variables d'environnement
- **DEP-003**: `@mastra/core` — Agent, createTool
- **DEP-004**: `zod` — validation
- **DEP-005**: Memory Agent — pour le contexte historique
- **DEP-006**: `src/mastra/connections/plane-provider.ts` — connexion Plane existante

---

## 6. Files

- **FILE-001**: `src/mastra/agents/plane/domain/types.ts` — Types (nouveau)
- **FILE-002**: `src/mastra/agents/plane/domain/schemas.ts` — Schémas Zod (nouveau)
- **FILE-003**: `src/mastra/agents/plane/domain/contracts.ts` — Contrats (nouveau)
- **FILE-004**: `src/mastra/agents/plane/domain/enums.ts` — Enums (nouveau)
- **FILE-005**: `src/mastra/agents/plane/plane-instructions.ts` — Instructions (nouveau)
- **FILE-006**: `src/mastra/agents/plane/agent.ts` — Agent (nouveau)
- **FILE-007**: `src/mastra/agents/plane/index.ts` — Entry point (nouveau)
- **FILE-008**: `src/mastra/agents/plane/services/project-service.ts` — Service projets (nouveau)
- **FILE-009**: `src/mastra/agents/plane/services/work-item-service.ts` — Service work items (nouveau)
- **FILE-010**: `src/mastra/agents/plane/services/cycle-service.ts` — Service cycles (nouveau)
- **FILE-011**: `src/mastra/agents/plane/services/module-service.ts` — Service modules (nouveau)
- **FILE-012**: `src/mastra/agents/plane/services/advancement-service.ts` — Service avancement (nouveau)
- **FILE-013**: `src/mastra/agents/plane/services/comment-service.ts` — Service commentaires (nouveau)
- **FILE-014**: `src/mastra/agents/plane/tools/plane-advancement-tool.ts` — Outil avancement (nouveau)
- **FILE-015**: `src/mastra/agents/plane/tools/plane-workitem-tool.ts` — Outil work items (nouveau)
- **FILE-016**: `src/mastra/agents/plane/tools/plane-blockage-tool.ts` — Outil blocages (nouveau)
- **FILE-017**: `src/mastra/agents/plane/tools/plane-report-tool.ts` — Outil rapports (nouveau)
- **FILE-018**: `src/mastra/agents/plane/tools/index.ts` — Index (nouveau)
- **FILE-019**: `src/mastra/routes/plane-routes.ts` — Routes API (nouveau)
- **FILE-020**: `src/mastra/index.ts` — Registration (modifié)
- **FILE-021**: `src/mastra/agents/companion/agent.ts` — Sous-agent (modifié)
- **FILE-022**: `src/mastra/instructions/companion-instructions.ts` — Instructions (modifié)

---

## 7. Testing

- **TEST-001**: listProjects retourne les projets du workspace
- **TEST-002**: getAdvancementReport retourne un rapport complet
- **TEST-003**: detectBlockages identifie les work items bloqués
- **TEST-004**: createWorkItem avec données valides → work item créé
- **TEST-005**: updateWorkItem changement de state → état mis à jour
- **TEST-006**: Plane Agent en mode dégradé → erreur explicite
- **TEST-007**: Compagnon délègue correctement au Plane Agent
- **TEST-008**: Plane Agent interroge le Memory Agent
- **TEST-009**: Rapport inclut les métriques de complétion
- **TEST-010**: Détection de discrepancies Plane vs réalité observée

---

## 8. Risks & Assumptions

- **RISK-001**: Plane peut ne pas être configuré → Mitigation: mode dégradé
- **RISK-002**: Les permissions Plane peuvent limiter les opérations → Mitigation: vérifier avant d'agir
- **RISK-003**: Le MCP Plane peut être instable → Mitigation: retry avec backoff
- **ASSUMPTION-001**: `PLANE_API_KEY` et `PLANE_WORKSPACE_SLUG` sont configurés
- **ASSUMPTION-002**: L'utilisateur a les permissions Plane appropriées
- **ASSUMPTION-003**: Le workspace Plane contient des projets actifs

---

## 9. Workflow Type

```
UTILISATEUR: "Où en est le projet Compagnon ?"

COMPAGNON:
  1. → delegate to planeAgent({ operation: "advancement_report", project: "compagnon" })
  
PLANE AGENT:
  1. → plane_list_projects() — trouve le projet
  2. → plane_list_issues(project_id) — récupère les work items
  3. → plane_list_cycles(project_id) — récupère les cycles
  4. → memoryAgent({ retrieve: "compagnon decisions episodes" })
  5. Génère le rapport d'avancement
  6. Retourne: { status: "success", report: {...}, recommendations: [...] }
  
COMPAGNON:
  📊 Rapport d'avancement — Projet Compagnon
  
  ✅ Terminé: 12/20 (60%)
  🔄 En cours: 5/20 (25%)
  📋 À faire: 3/20 (15%)
  🚫 Bloqué: 0
  
  📅 Cycle actuel: v1.2 — 3 jours restants
  📦 Module Memory: 80% complété
  
  💡 Recommandations:
  - Finaliser les tests du module Memory avant le prochain cycle
  - La dette technique sur l'auth doit être traitée
```
