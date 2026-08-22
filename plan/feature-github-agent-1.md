---
goal: "Agent GitHub spécialisé pour les opérations sur les dépôts, issues, PR, et l'analyse de code via GitHub"
version: 1.0
date_created: 2026-08-22
last_updated: 2026-08-22
owner: Compagnon
status: 'Implemented'
tags: ['agent', 'github', 'mcp', 'feature']
---

# GitHub Agent — Agent Spécialisé Opérations GitHub

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

## Introduction

Le GitHub Agent est un sous-agent spécialisé du Compagnon, responsable de toutes les opérations GitHub : gestion des issues, pull requests, analyse de code, recherche dans les dépôts, et interaction avec l'API GitHub.

Il utilise les outils MCP GitHub existants (`@modelcontextprotocol/server-github`) et les skills GitHub déjà configurés. Il est conçu pour être délégué par le Compagnon lorsque l'utilisateur a besoin d'opérations GitHub, et pour interagir avec le Memory Agent quand une question nécessite du contexte historique.

---

## 1. Requirements & Constraints

- **REQ-001**: L'agent doit pouvoir créer, lire, mettre à jour et commenter les issues GitHub
- **REQ-002**: L'agent doit pouvoir lister et inspecter les pull requests
- **REQ-003**: L'agent doit pouvoir rechercher dans les dépôts (code, issues, commits)
- **REQ-004**: L'agent doit pouvoir consulter les informations d'un dépôt (branches, tags, releases)
- **REQ-005**: L'agent doit pouvoir analyser les fichiers d'un dépôt
- **REQ-006**: L'agent doit pouvoir interagir avec le Memory Agent pour le contexte historique
- **REQ-007**: L'agent doit respecter les permissions GitHub (read/write/delete)
- **REQ-008**: L'agent ne doit jamais exposer les credentials GitHub
- **REQ-009**: L'agent doit fonctionner en mode dégradé si GitHub MCP n'est pas configuré
- **REQ-010**: L'agent doit logger toutes les opérations via le système d'observabilité
- **REQ-011**: L'agent doit pouvoir être délégué par le Compagnon via Mastra subagents
- **REQ-012**: L'agent doit pouvoir poser des questions au Memory Agent (ex: "quel repo pour ce projet ?")
- **CON-001**: Utiliser les outils MCP GitHub existants, pas créer de nouvelle connexion
- **CON-002**: Ne pas dupliquer les skills GitHub existants (github-issues, github-issue-query, etc.)
- **CON-003**: L'agent doit être indépendamment testable
- **CON-004**: Suivre l'architecture modulaire existante (`domain/`, `services/`, `tools/`)
- **GUD-001**: Utiliser Zod pour la validation de tous les schémas d'entrée/sortie
- **GUD-002**: Utiliser `createTool` de `@mastra/core/tools` pour les outils
- **GUD-003**: Enregistrer l'agent dans `src/mastra/index.ts`
- **PAT-001**: Suivre le pattern Agent + Subagent de Mastra
- **PAT-002**: Utiliser la délégation native Mastra pour Compagnon → GitHub Agent

---

## 2. Architecture

```
┌─────────────────────────────────────────────────┐
│              COMPAGNON (Main Agent)              │
│                                                  │
│  "Crée une issue pour le bug d'auth"            │
│  "Qu'est-ce qui a changé sur novaris ?"         │
│  "Merge la PR #42"                               │
├────────────────┬────────────────────────────────┤
│                │ DÉLÉGATION                      │
│                ▼                                 │
│  ┌─────────────────────────────┐                │
│  │      GITHUB AGENT           │                │
│  │                             │                │
│  │  instructions:              │                │
│  │  - Opérations GitHub        │                │
│  │  - Gestion issues/PR        │                │
│  │  - Analyse de code          │                │
│  │  - Recherche dépôts         │                │
│  │                             │                │
│  │  tools:                     │                │
│  │  - MCP GitHub (existant)    │                │
│  │  - Memory Agent (délégation)│                │
│  └──────────┬──────────────────┘                │
│             │                                    │
│  ┌──────────▼──────────────────┐                │
│  │  OUTILS DISPONIBLES         │                │
│  │                             │                │
│  │  MCP GitHub (via npx):      │                │
│  │  • list_issues              │                │
│  │  • get_issue                │                │
│  │  • create_issue             │                │
│  │  • update_issue             │                │
│  │  • add_comment              │                │
│  │  • list_pull_requests       │                │
│  │  • get_pull_request         │                │
│  │  • create_pull_request      │                │
│  │  • merge_pull_request       │                │
│  │  • search_code              │                │
│  │  • list_commits             │                │
│  │  • get_file_contents        │                │
│  │  • list_branches            │                │
│  │  • create_branch            │                │
│  │  • create_tag               │                │
│  │  • list_releases            │                │
│  └─────────────────────────────┘                │
└─────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Phase 1 — Domain Models & Configuration

- GOAL-001: Définir les types, contrats et configuration du GitHub Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/mastra/agents/github/domain/types.ts` | ✅ | 2026-08-22 |
| TASK-002 | Créer `src/mastra/agents/github/domain/schemas.ts` | ✅ | 2026-08-22 |
| TASK-003 | Créer `src/mastra/agents/github/domain/contracts.ts` | ✅ | 2026-08-22 |
| TASK-004 | Créer `src/mastra/agents/github/domain/enums.ts` | ✅ | 2026-08-22 |
| TASK-005 | Créer `src/mastra/agents/github/config.ts` | ✅ | 2026-08-22 |

### Phase 2 — Instructions & Agent

- GOAL-002: Créer l'instructions system prompt et l'agent Mastra

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Créer `src/mastra/agents/github/github-instructions.ts` | ✅ | 2026-08-22 |
| TASK-007 | Créer `src/mastra/agents/github/agent.ts` | ✅ | 2026-08-22 |
| TASK-008 | Créer `src/mastra/agents/github/index.ts` | ✅ | 2026-08-22 |

**System Prompt du GitHub Agent (contenu clé):**
```
You are Compagnon's GitHub Agent.

Your role is to perform GitHub operations on behalf of the main agent.

CORE RESPONSIBILITIES:
- Create, read, update, and comment on GitHub issues
- Manage pull requests (list, inspect, create, merge)
- Search code across repositories
- Inspect repository structure, branches, commits, releases
- Analyze code files and provide insights

RULES:
1. Always verify the repository exists before operating on it
2. Use the most specific identifier available (issue number > title search)
3. Never expose API tokens or credentials
4. Distinguish between observed state and inferred state
5. Report operation results honestly — never claim success without evidence
6. When uncertain about which repo/project, ask the Memory Agent

MEMORY INTEGRATION:
- Before operating, check Memory Agent for project context (which repo, conventions)
- After significant operations, suggest storing decisions/outcomes in Memory
- When asked about project history, delegate to Memory Agent first

DELEGATION CONTRACT:
Input: { operation, repository, parameters }
Output: { status, result, errors, suggestions }
```

### Phase 3 — Services

- GOAL-003: Implémenter les services métier

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Créer `src/mastra/agents/github/services/issue-service.ts` | ✅ | 2026-08-22 |
| TASK-010 | Créer `src/mastra/agents/github/services/pr-service.ts` | ✅ | 2026-08-22 |
| TASK-011 | Créer `src/mastra/agents/github/services/repo-service.ts` | ✅ | 2026-08-22 |
| TASK-012 | Créer `src/mastra/agents/github/services/search-service.ts` | ✅ | 2026-08-22 |
| TASK-013 | Créer `src/mastra/agents/github/services/analysis-service.ts` | ✅ | 2026-08-22 |

**Détail `GitHubAgentInput`:**
```typescript
interface GitHubAgentInput {
  operation: GitHubOperation;
  repository?: string;      // "owner/repo"
  parameters: {
    issueNumber?: number;
    title?: string;
    body?: string;
    state?: IssueState;
    labels?: string[];
    assignees?: string[];
    prNumber?: number;
    branch?: string;
    baseBranch?: string;
    filePath?: string;
    query?: string;
    page?: number;
    perPage?: number;
  };
  context?: string;         // contexte supplémentaire
  memoryContext?: unknown;  // contexte du Memory Agent
}
```

**Détail `GitHubAgentResult`:**
```typescript
interface GitHubAgentResult {
  status: 'success' | 'partial' | 'failed' | 'blocked' | 'needs_clarification';
  operation: GitHubOperation;
  result?: unknown;
  summary: string;
  errors?: string[];
  warnings?: string[];
  suggestions?: string[];
  memoryRecommendations?: string[];  // suggested memory operations
}
```

### Phase 4 — Integration & Registration

- GOAL-004: Intégrer l'agent dans l'écosystème Compagnon

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Mettre à jour `src/mastra/index.ts` | ✅ | 2026-08-22 |
| TASK-015 | Mettre à jour `src/mastra/agents/companion/agent.ts` | ✅ | 2026-08-22 |
| TASK-016 | Mettre à jour `src/mastra/instructions/companion-instructions.ts` | ✅ | 2026-08-22 |
| TASK-017 | Créer `src/mastra/routes/github-routes.ts` | ✅ | 2026-08-22 |
| TASK-018 | Ajouter les routes GitHub dans `src/mastra/index.ts` | ✅ | 2026-08-22 |

### Phase 5 — Tools Exposés

- GOAL-005: Créer des outils Mastra pour le GitHub Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Créer `src/mastra/agents/github/tools/github-tools.ts` (12 tools) | ✅ | 2026-08-22 |
| TASK-020 | (consolidé dans github-tools.ts) | ✅ | 2026-08-22 |
| TASK-021 | (consolidé dans github-tools.ts) | ✅ | 2026-08-22 |
| TASK-022 | (consolidé dans github-tools.ts) | ✅ | 2026-08-22 |
| TASK-023 | Créer `src/mastra/agents/github/tools/index.ts` | ✅ | 2026-08-22 |

### Phase 6 — Tests

- GOAL-006: Valider le GitHub Agent

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Tests (à implémenter) | ⏳ | |
| TASK-025 | Tests (à implémenter) | ⏳ | |
| TASK-026 | Tests (à implémenter) | ⏳ | |
| TASK-027 | Tests (à implémenter) | ⏳ | |
| TASK-028 | Tests (à implémenter) | ⏳ | |
| TASK-029 | `tsc --noEmit` validé ✅ | ✅ | 2026-08-22 |
| TASK-030 | Créer `src/mastra/agents/github/README.md` | ✅ | 2026-08-22 |

---

## 4. Alternatives

- **ALT-001**: Utiliser uniquement les skills GitHub existants sans agent dédié → Rejeté: pas de structure de délégation, pas de contrat formel, pas d'intégration mémoire
- **ALT-002**: Créer une connexion GitHub native (pas MCP) → Rejeté: le MCP GitHub est déjà fonctionnel et testé
- **ALT-003**: Fusionner GitHub Agent avec le Companion → Rejàtè: viole la séparation des responsabilités, surcharge le Companion

---

## 5. Dependencies

- **DEP-001**: `@modelcontextprotocol/server-github` — déjà configuré dans `src/mastra/mcp/github.ts`
- **DEP-002**: `GITHUB_TOKEN` — variable d'environnement requise
- **DEP-003**: `@mastra/core` — Agent, createTool
- **DEP-004**: `@mastra/mcp` — MCPClient pour les outils GitHub
- **DEP-005**: `zod` — validation des schémas
- **DEP-006**: Memory Agent — pour le contexte historique

---

## 6. Files

- **FILE-001**: `src/mastra/agents/github/domain/types.ts` — Types (nouveau)
- **FILE-002**: `src/mastra/agents/github/domain/schemas.ts` — Schémas Zod (nouveau)
- **FILE-003**: `src/mastra/agents/github/domain/contracts.ts` — Contrats délégation (nouveau)
- **FILE-004**: `src/mastra/agents/github/domain/enums.ts` — Enums (nouveau)
- **FILE-005**: `src/mastra/agents/github/config.ts` — Configuration (nouveau)
- **FILE-006**: `src/mastra/agents/github/github-instructions.ts` — Instructions (nouveau)
- **FILE-007**: `src/mastra/agents/github/agent.ts` — Agent Mastra (nouveau)
- **FILE-008**: `src/mastra/agents/github/index.ts` — Entry point (nouveau)
- **FILE-009**: `src/mastra/agents/github/services/issue-service.ts` — Service issues (nouveau)
- **FILE-010**: `src/mastra/agents/github/services/pr-service.ts` — Service PRs (nouveau)
- **FILE-011**: `src/mastra/agents/github/services/repo-service.ts` — Service dépôts (nouveau)
- **FILE-012**: `src/mastra/agents/github/services/search-service.ts` — Service recherche (nouveau)
- **FILE-013**: `src/mastra/agents/github/services/analysis-service.ts` — Service analyse (nouveau)
- **FILE-014**: `src/mastra/agents/github/tools/github-issue-tool.ts` — Outil issues (nouveau)
- **FILE-015**: `src/mastra/agents/github/tools/github-pr-tool.ts` — Outil PRs (nouveau)
- **FILE-016**: `src/mastra/agents/github/tools/github-search-tool.ts` — Outil recherche (nouveau)
- **FILE-017**: `src/mastra/agents/github/tools/github-repo-tool.ts` — Outil dépôts (nouveau)
- **FILE-018**: `src/mastra/agents/github/tools/index.ts` — Index outils (nouveau)
- **FILE-019**: `src/mastra/routes/github-routes.ts` — Routes API (nouveau)
- **FILE-020**: `src/mastra/index.ts` — Registration (modifié)
- **FILE-021**: `src/mastra/agents/companion/agent.ts` — Sous-agent (modifié)
- **FILE-022**: `src/mastra/instructions/companion-instructions.ts` — Instructions (modifié)

---

## 7. Testing

- **TEST-001**: createIssue avec données valides → issue créée avec numéro
- **TEST-002**: getIssue avec numéro existant → détails retournés
- **TEST-003**: getIssue avec numéro inexistant → erreur explicite
- **TEST-004**: listIssues avec filtres → résultats filtrés
- **TEST-005**: searchCode avec query → résultats de recherche
- **TEST-006**: GitHub Agent invoqué via délégation → résultat structuré
- **TEST-007**: GitHub Agent en mode dégradé (pas de token) → erreur explicite
- **TEST-008**: Compagnon délègue correctement au GitHub Agent
- **TEST-009**: GitHub Agent interroge le Memory Agent pour le contexte
- **TEST-010**: Opération échouée → statut "failed" avec erreurs détaillées

---

## 8. Risks & Assumptions

- **RISK-001**: Le MCP GitHub peut ne pas être disponible → Mitigation: mode dégradé avec erreur explicite
- **RISK-002**: Les permissions GitHub peuvent limiter certaines opérations → Mitigation: vérifier les permissions avant d'agir
- **RISK-003**: Le rate limiting GitHub peut bloquer les opérations → Mitigation: respecter les headers rate-limit, retry avec backoff
- **ASSUMPTION-001**: `GITHUB_TOKEN` est configuré pour les opérations d'écriture
- **ASSUMPTION-002**: Le MCP GitHub est déjà installé et testé
- **ASSUMPTION-003**: L'utilisateur a les permissions GitHub appropriées

---

## 9. Workflow Type

```
UTILISATEUR: "Crée une issue sur compagnon pour le bug d'auth"

COMPAGNON:
  1. → memory_search(query="compagnon repo github")
  2. Contexte trouvé: repo = "user/compagnon"
  3. → delegate to githubAgent({ operation: "create_issue", repo: "user/compagnon", title: "Bug auth", ... })
  
GITHUB AGENT:
  1. Vérifie le repo via MCP
  2. Crée l'issue via MCP
  3. Retourne: { status: "success", result: { number: 42, url: "..." }, summary: "Issue #42 créée" }
  
COMPAGNON:
  1. Présente le résultat à l'utilisateur
  2. → memory_record_decision("Issue #42 créée pour bug auth")
```
