---
goal: "Concevoir et implémenter un système de mémoire professionnel pour un agent compagnon de développement capable d'observer, suivre, résumer et anticiper les besoins des projets"
version: 1.0
date_created: 2026-08-22
last_updated: 2026-08-22
owner: Compagnon
status: 'Deprecated'
tags: ['architecture', 'feature', 'memory', 'companion']
---

# Mémoire Professionnelle — Agent Compagnon de Développement

![Status: Deprecated](https://img.shields.io/badge/status-Deprecated-red)

> **⚠️ DEPRECATED** — Remplacé par `plan/refactor-memory-mastra-unification-1.md`.
> Ce plan proposait d'**étendre** le sous-système mémoire custom (snapshots/trends/recap/profil sur Turso).
> La décision retenue est l'inverse : **abandonner le sous-système custom et unifier tout sur Mastra Memory natif** (LibSQL + vector + semantic recall + working memory + observational memory). Ne pas implémenter ce plan.

## Introduction

Le système mémoire actuel de Compagnon est une **mémoire de connaissance projet** (faits, épisodes, procédures, décisions). Il fonctionne bien pour stocker des informations isolées, mais il ne permet pas à l'agent d'être un **vrai compagnon de développement** : observer automatiquement les projets, suivre leur état dans le temps, détecter les problèmes critiques, et produire des récaps utiles.

Ce plan définit les **6 composantes manquantes** pour transformer la mémoire existante en un système professionnel complet.

---

## 1. Requirements & Constraints

- **REQ-001**: La mémoire doit supporter l'observation **proactive** (pas seulement sur demande)
- **REQ-002**: Chaque projet doit avoir un **snapshot d'état** à chaque observation (git, build, tests, issues)
- **REQ-003**: L'historique des snapshots doit permettre de détecter des **tendances** (amélioration, dégradation, stabilité)
- **REQ-004**: Un service de **récap** doit pouvoir produire une vue d'ensemble de tous les projets suivis
- **REQ-005**: Un **profil développeur** doit capturer les préférences, le style de travail, et les priorités de l'utilisateur
- **REQ-006**: Les conversations doivent pouvoir **enrichir automatiquement** la mémoire persistante
- **REQ-007**: Le système doit rester **modulaire** — chaque composante est indépendamment testable et remplaçable
- **REQ-008**: La mémoire existante (faits, épisodes, procédures, décisions) doit être **préservée et étendue**, pas remplacée
- **REQ-009**: Le schéma de stockage doit être **compatible** avec le Turso/SQLite existant
- **REQ-010**: Chaque opération mémoire doit être **traçable** via le système d'observabilité existant
- **CON-001**: Pas de dépendance à un service externe pour l'observation (le compagnon observe via ses outils disponibles)
- **CON-002**: Le système doit fonctionner même sans connexion réseau (observation locale uniquement)
- **CON-003**: Les snapshots ne doivent pas polluer la base — implémenter une politique de rétention
- **GUD-001**: Suivre l'architecture modulaire existante du module memory (`domain/`, `services/`, `repositories/`, `tools/`, `storage/`)
- **GUD-002**: Utiliser Zod pour la validation de tous les schémas d'entrée/sortie
- **GUD-003**: Toute opération d'écriture doit passer par le `memoryManager` (facade)
- **PAT-001**: Suivre le pattern Repository pour l'accès aux données
- **PAT-002**: Suivre le pattern Service pour la logique métier
- **PAT-003**: Utiliser les enums typés comme existant dans `domain/enums.ts`

---

## 2. Architecture Vue d'Ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                     COMPAGNON (Main Agent)                       │
│                                                                  │
│  Instructions: "AVANT toute tâche, consulter la mémoire"        │
│  Hooks: retrieveRelevantMemories → execute → extractTaskMemories │
├──────────┬──────────────────────────────────────────────────────┤
│          │                                                       │
│  ┌───────▼────────┐    ┌──────────────────┐                     │
│  │  MEMORY AGENT  │    │  OBSERVATION     │                     │
│  │  (existant)    │    │  ENGINE (nouveau) │                     │
│  │                │    │                  │                     │
│  │  • search      │    │  • observeProject│                     │
│  │  • remember    │    │  • createSnapshot│                     │
│  │  • episodes    │    │  • detectTrends  │                     │
│  │  • procedures  │    │  • generateRecap │                     │
│  │  • decisions   │    │                  │                     │
│  │  • conflicts   │    └──────────────────┘                     │
│  └────────────────┘                                             │
│          │                                                       │
│  ┌───────▼────────────────────────────────────────────────┐     │
│  │                    MEMORY SERVICES                      │     │
│  │                                                         │     │
│  │  EXISTANTS:              NOUVEAUX:                      │     │
│  │  • search                • project-snapshot-service      │     │
│  │  • remember              • trend-analyzer-service        │     │
│  │  • record-episode        • project-recap-service         │     │
│  │  • record-decision       • developer-profile-service     │     │
│  │  • procedures            • conversation-pipeline-service │     │
│  │  • conflict              • observation-engine-service    │     │
│  │  • verify                                                 │     │
│  │  • consolidation                                        │     │
│  └─────────────────────────────────────────────────────────┘     │
│          │                                                       │
│  ┌───────▼─────────────────────────────────────────────────┐     │
│  │                    DOMAIN (étendu)                        │     │
│  │                                                          │     │
│  │  EXISTANTS:              NOUVEAUX:                       │     │
│  │  • types.ts              • project-snapshot.ts            │     │
│  │  • schemas.ts            • developer-profile.ts           │     │
│  │  • enums.ts              • project-recap.ts               │     │
│  │  • contracts.ts          • trend-types.ts                 │     │
│  │                         • observation-types.ts            │     │
│  └──────────────────────────────────────────────────────────┘     │
│          │                                                       │
│  ┌───────▼─────────────────────────────────────────────────┐     │
│  │                 STORAGE (étendu)                          │     │
│  │                                                          │     │
│  │  Tables nouvelles:                                        │     │
│  │  • project_snapshots                                      │     │
│  │  • developer_profiles                                     │     │
│  │  • observation_log                                        │     │
│  └──────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Implementation Steps

### Phase 1 — Domain Models & Storage (Fondations)

- GOAL-001: Définir les types, schémas Zod et tables SQL pour les nouveaux modèles mémoire

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Créer `src/mastra/agents/memory/domain/project-snapshot.ts` — Types TypeScript: `ProjectSnapshot`, `ProjectHealth`, `GitState`, `BuildState`, `TestState`, `SnapshotInput` | | |
| TASK-002 | Créer `src/mastra/agents/memory/domain/developer-profile.ts` — Types: `DeveloperProfile`, `WorkingStyle`, `ProjectPriority`, `ProfileInput` | | |
| TASK-003 | Créer `src/mastra/agents/memory/domain/project-recap.ts` — Types: `ProjectRecap`, `TrendAnalysis`, `RecapEntry`, `MultiProjectRecap` | | |
| TASK-004 | Créer `src/mastra/agents/memory/domain/observation-types.ts` — Types: `ObservationResult`, `ObservationInput`, `ObservationCapability` | | |
| TASK-005 | Ajouter les schémas Zod correspondants dans `src/mastra/agents/memory/domain/schemas.ts` — `projectSnapshotSchema`, `developerProfileSchema`, `projectRecapSchema` | | |
| TASK-006 | Étendre `src/mastra/agents/memory/storage/schema.ts` — Ajouter les tables SQL: `project_snapshots`, `developer_profiles`, `observation_log` | | |
| TASK-007 | Mettre à jour `src/mastra/agents/memory/domain/types.ts` — Ajouter les exports des nouveaux types | | |
| TASK-008 | Mettre à jour `src/mastra/agents/memory/index.ts` — Exports des nouveaux modules | | |

**Détail schéma `project_snapshots`:**
```sql
CREATE TABLE IF NOT EXISTS project_snapshots (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  repository TEXT,
  observed_at TEXT NOT NULL,

  -- Git state
  git_branch TEXT,
  git_commits_ahead INTEGER DEFAULT 0,
  git_commits_behind INTEGER DEFAULT 0,
  git_uncommitted_changes INTEGER DEFAULT 0,
  git_last_commit_message TEXT,
  git_last_commit_author TEXT,
  git_last_commit_date TEXT,

  -- Build state
  build_status TEXT CHECK (build_status IN ('passing', 'failing', 'unknown', 'not_configured')),
  build_last_run_at TEXT,

  -- Test state
  tests_total INTEGER DEFAULT 0,
  tests_passing INTEGER DEFAULT 0,
  tests_failing INTEGER DEFAULT 0,
  tests_skipped INTEGER DEFAULT 0,
  test_last_run_at TEXT,

  -- Issues
  open_issues INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,

  -- Health
  health TEXT CHECK (health IN ('healthy', 'warning', 'critical', 'unknown')) NOT NULL DEFAULT 'unknown',
  health_score REAL CHECK (health_score >= 0 AND health_score <= 1),

  -- File changes (summary)
  files_changed INTEGER DEFAULT 0,
  lines_added INTEGER DEFAULT 0,
  lines_removed INTEGER DEFAULT 0,

  -- Metadata
  observation_source TEXT,  -- which tool/capability produced this
  raw_data TEXT,             -- JSON blob for extensibility

  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_project_snapshots_project ON project_snapshots(project);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_observed ON project_snapshots(observed_at);
CREATE INDEX IF NOT EXISTS idx_project_snapshots_health ON project_snapshots(health);
```

**Détail schéma `developer_profiles`:**
```sql
CREATE TABLE IF NOT EXISTS developer_profiles (
  id TEXT PRIMARY KEY,
  profile_key TEXT NOT NULL UNIQUE,

  -- Preferences
  preferred_language TEXT DEFAULT 'fr',
  preferred_communication_style TEXT DEFAULT 'concise',
  timezone TEXT,

  -- Working patterns
  preferred_working_hours TEXT,
  typical_project_count INTEGER DEFAULT 0,
  primary_focus TEXT,  -- 'backend', 'frontend', 'fullstack', 'devops', etc.

  -- Project priorities
  priority_projects TEXT,  -- JSON array of project names ordered by priority

  -- Metadata
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

**Détail schéma `observation_log`:**
```sql
CREATE TABLE IF NOT EXISTS observation_log (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL,
  observation_type TEXT NOT NULL,
  capability_used TEXT,
  result_summary TEXT,
  observed_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_observation_log_project ON observation_log(project);
CREATE INDEX IF NOT EXISTS idx_observation_log_observed ON observation_log(observed_at);
```

---

### Phase 2 — Repositories (Accès aux Données)

- GOAL-002: Implémenter les repositories pour les nouvelles tables

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-009 | Créer `src/mastra/agents/memory/repositories/snapshot-repository.ts` — CRUD pour `project_snapshots`: `createSnapshot`, `findSnapshotsByProject`, `findLatestSnapshot`, `findSnapshotsByDateRange`, `findSnapshotsByHealth`, `deleteOldSnapshots` | | |
| TASK-010 | Créer `src/mastra/agents/memory/repositories/profile-repository.ts` — CRUD pour `developer_profiles`: `getProfile`, `upsertProfile`, `updateProfileField` | | |
| TASK-011 | Créer `src/mastra/agents/memory/repositories/observation-repository.ts` — CRUD pour `observation_log`: `logObservation`, `findObservationsByProject`, `findRecentObservations` | | |

---

### Phase 3 — Services Métier (Logique)

- GOAL-003: Implémenter les services qui contiennent la logique métier

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Créer `src/mastra/agents/memory/services/project-snapshot-service.ts` — `createProjectSnapshot(input: SnapshotInput): ProjectSnapshot`, `getLatestSnapshot(project): ProjectSnapshot | null`, `getSnapshotHistory(project, days): ProjectSnapshot[]` | | |
| TASK-013 | Créer `src/mastra/agents/memory/services/trend-analyzer-service.ts` — `analyzeTrends(project, days): TrendAnalysis`, `calculateHealthScore(snapshot): number`, `detectDegradation(snapshots): string[]`, `detectImprovement(snapshots): string[]` | | |
| TASK-014 | Créer `src/mastra/agents/memory/services/project-recap-service.ts` — `generateProjectRecap(project): ProjectRecap`, `generateMultiProjectRecap(): MultiProjectRecap`, `formatRecapForDisplay(recap): string` | | |
| TASK-015 | Créer `src/mastra/agents/memory/services/developer-profile-service.ts` — `getOrCreateProfile(): DeveloperProfile`, `updateProfile(input: ProfileInput): DeveloperProfile`, `addPriorityProject(project, priority): void` | | |
| TASK-016 | Créer `src/mastra/agents/memory/services/conversation-pipeline-service.ts` — `extractFromConversation(messages): CandidateMemory[]`, `classifyCandidate(candidate): MemoryType`, `shouldStore(candidate): boolean` | | |
| TASK-017 | Créer `src/mastra/agents/memory/services/observation-engine-service.ts` — `observeProject(project, capabilities): ObservationResult`, `computeHealth(snapshot): ProjectHealth`, `aggregateObservationResults(results): ObservationResult` | | |

**Détail `TrendAnalysis`:**
```typescript
interface TrendAnalysis {
  project: string;
  periodDays: number;
  snapshotCount: number;

  // Health trend
  healthTrend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  currentHealth: ProjectHealth;
  previousHealth: ProjectHealth | null;

  // Git activity
  commitFrequency: number;  // commits per day average
  lastActivity: string;     // ISO date

  // Test trend
  testTrend: 'improving' | 'stable' | 'declining' | 'unknown';
  currentTestPassRate: number;
  previousTestPassRate: number | null;

  // Build trend
  buildTrend: 'improving' | 'stable' | 'declining' | 'unknown';

  // Issues
  issueTrend: 'improving' | 'stable' | 'worsening' | 'unknown';

  // Alerts
  alerts: string[];  // critical items needing attention

  // Suggestions
  suggestions: string[];  // improvement recommendations
}
```

**Détail `ProjectRecap`:**
```typescript
interface ProjectRecap {
  project: string;
  observedAt: string;  // ISO date

  // Current state
  health: ProjectHealth;
  healthScore: number;

  // Summary
  summary: string;  // human-readable one-liner

  // Key metrics
  metrics: {
    gitBranch: string;
    uncommittedChanges: number;
    testsPassing: number;
    testsFailing: number;
    openIssues: number;
    criticalIssues: number;
    lastCommit: string;
    lastActivity: string;
  };

  // Trends (if enough data)
  trends: TrendAnalysis | null;

  // Recommendations
  recommendations: string[];

  // Critical items
  criticalItems: string[];
}

interface MultiProjectRecap {
  observedAt: string;
  totalProjects: number;
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  projects: ProjectRecap[];
  globalAlerts: string[];
  globalSuggestions: string[];
}
```

---

### Phase 4 — Outils Memory Agent (Tools)

- GOAL-004: Exposer les nouvelles capacités comme des outils pour le Memory Agent et le Companion

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Créer `src/mastra/agents/memory/tools/observe-project.ts` — Outil `memory_observe_project`: prend un nom de projet + les résultats d'observation (git status, build, tests, issues) et crée un snapshot | | |
| TASK-019 | Créer `src/mastra/agents/memory/tools/get-recap.ts` — Outil `memory_get_recap`: retourne le récap d'un projet ou de tous les projets | | |
| TASK-020 | Créer `src/mastra/agents/memory/tools/get-trends.ts` — Outil `memory_get_trends`: retourne l'analyse de tendances d'un projet | | |
| TASK-021 | Créer `src/mastra/agents/memory/tools/update-profile.ts` — Outil `memory_update_profile`: met à jour le profil développeur | | |
| TASK-022 | Créer `src/mastra/agents/memory/tools/get-profile.ts` — Outil `memory_get_profile`: retourne le profil développeur | | |
| TASK-023 | Créer `src/mastra/agents/memory/tools/get-snapshot-history.ts` — Outil `memory_get_snapshot_history`: retourne l'historique des snapshots d'un projet | | |
| TASK-024 | Mettre à jour `src/mastra/agents/memory/tools/index.ts` — Exporter les nouveaux outils | | |
| TASK-025 | Mettre à jour `src/mastra/agents/memory/agent.ts` — Enregistrer les nouveaux outils dans le Memory Agent | | |

---

### Phase 5 — Hooks & Pipeline (Automatisation)

- GOAL-005: Activer et étendre les hooks mémoire pour l'observation proactive

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-026 | Décommenter et activer `executeWithMemory` dans `src/mastra/agents/companion/agent.ts` | | |
| TASK-027 | Créer `src/mastra/agents/memory/hooks/observation-hooks.ts` — `observeAndRecordProject(project, observationResults)`, `autoObserveOnTaskCompletion(task, project)` | | |
| TASK-028 | Créer `src/mastra/agents/memory/hooks/conversation-hooks.ts` — `extractMemoriesFromConversation(messages)`, `classifyAndStore(candidates)` | | |
| TASK-029 | Mettre à jour `src/mastra/agents/memory/hooks/index.ts` — Exporter les nouveaux hooks | | |
| TASK-030 | Mettre à jour `src/mastra/instructions/companion-instructions.ts` — Ajouter les instructions pour l'observation proactive et le récap | | |

**Nouvelles instructions à ajouter au Companion:**
```
## Proactive Observation — CRITICAL

When completing any task on a project, you MUST observe the project state
after execution:

1. After ANY code change → observe git status, build status, test results
2. After task completion → create a project snapshot via memory_observe_project
3. When asked for a recap → use memory_get_recap
4. When starting work → check memory_get_trends for degradation alerts

You have tools to observe projects:
- memory_observe_project: record project state
- memory_get_recap: get project summary
- memory_get_trends: get trend analysis
- memory_get_profile: get user preferences
- memory_update_profile: update user preferences

NEVER claim to monitor a project unless you have actually observed it.
NEVER present stale observation as current state.
```

---

### Phase 6 — Intégration & Tests

- GOAL-006: Valider le système complet

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-031 | Créer `src/mastra/agents/memory/tests/project-snapshot.test.ts` — Tests unitaires pour le snapshot service | | |
| TASK-032 | Créer `src/mastra/agents/memory/tests/trend-analyzer.test.ts` — Tests unitaires pour l'analyse de tendances | | |
| TASK-033 | Créer `src/mastra/agents/memory/tests/project-recap.test.ts` — Tests unitaires pour le récap | | |
| TASK-034 | Créer `src/mastra/agents/memory/tests/developer-profile.test.ts` — Tests unitaires pour le profil | | |
| TASK-035 | Créer `src/mastra/agents/memory/tests/conversation-pipeline.test.ts` — Tests unitaires pour la pipeline conversation | | |
| TASK-036 | Créer `src/mastra/agents/memory/tests/observation-hooks.test.ts` — Tests d'intégration pour les hooks | | |
| TASK-037 | Exécuter le typecheck complet (`pnpm build`) et corriger les erreurs | | |
| TASK-038 | Mettre à jour `src/mastra/agents/memory/README.md` — Documentation de l'architecture complète | | |

---

## 4. Alternatives

- **ALT-001**: Utiliser un vector store (pgvector, Qdrant) pour la recherche sémantique → Rejeté: ajoute une dépendance externe, le LIKE SQL suffit pour l'étape 1, les embeddings peuvent être ajoutés plus tard
- **ALT-002**: Créer un agent "Observer" séparé du Memory Agent → Rejeté: complexifie l'architecture sans bénéfice, l'observation est une capacité mémoire naturelle
- **ALT-003**: Utiliser un cron/scheduler pour l'observation automatique → Rejeté: le compagnon observe via ses outils disponibles, pas via un scheduler externe
- **ALT-004**: Stocker les snapshots dans une base séparée (PostgreSQL, DuckDB) → Rejeté: Turso/SQLite est suffisant pour le volume attendu, la séparation complexifie inutilement

---

## 5. Dependencies

- **DEP-001**: `@libsql/client` — déjà installé, utilisé pour le stockage existant
- **DEP-002**: `@mastra/core` — Agent, Agent tool types
- **DEP-003**: `zod` — validation des schémas
- **DEP-004**: Outils d'observation du runtime (filesystem, git, etc.) — availability dépend de l'installation

---

## 6. Files

- **FILE-001**: `src/mastra/agents/memory/domain/project-snapshot.ts` — Types snapshot projet (nouveau)
- **FILE-002**: `src/mastra/agents/memory/domain/developer-profile.ts` — Types profil développeur (nouveau)
- **FILE-003**: `src/mastra/agents/memory/domain/project-recap.ts` — Types récap projet (nouveau)
- **FILE-004**: `src/mastra/agents/memory/domain/observation-types.ts` — Types observation (nouveau)
- **FILE-005**: `src/mastra/agents/memory/domain/schemas.ts` — Schémas Zod (modifié)
- **FILE-006**: `src/mastra/agents/memory/domain/types.ts` — Types existants (modifié)
- **FILE-007**: `src/mastra/agents/memory/storage/schema.ts` — Tables SQL (modifié)
- **FILE-008**: `src/mastra/agents/memory/repositories/snapshot-repository.ts` — Repository snapshots (nouveau)
- **FILE-009**: `src/mastra/agents/memory/repositories/profile-repository.ts` — Repository profil (nouveau)
- **FILE-010**: `src/mastra/agents/memory/repositories/observation-repository.ts` — Repository observations (nouveau)
- **FILE-011**: `src/mastra/agents/memory/services/project-snapshot-service.ts` — Service snapshot (nouveau)
- **FILE-012**: `src/mastra/agents/memory/services/trend-analyzer-service.ts` — Service tendances (nouveau)
- **FILE-013**: `src/mastra/agents/memory/services/project-recap-service.ts` — Service récap (nouveau)
- **FILE-014**: `src/mastra/agents/memory/services/developer-profile-service.ts` — Service profil (nouveau)
- **FILE-015**: `src/mastra/agents/memory/services/conversation-pipeline-service.ts` — Pipeline conversation (nouveau)
- **FILE-016**: `src/mastra/agents/memory/services/observation-engine-service.ts` — Moteur observation (nouveau)
- **FILE-017**: `src/mastra/agents/memory/services/memory-manager.ts` — Facade (modifié)
- **FILE-018**: `src/mastra/agents/memory/tools/observe-project.ts` — Outil observation (nouveau)
- **FILE-019**: `src/mastra/agents/memory/tools/get-recap.ts` — Outil récap (nouveau)
- **FILE-020**: `src/mastra/agents/memory/tools/get-trends.ts` — Outil tendances (nouveau)
- **FILE-021**: `src/mastra/agents/memory/tools/update-profile.ts` — Outil profil (nouveau)
- **FILE-022**: `src/mastra/agents/memory/tools/get-profile.ts` — Outil profil (nouveau)
- **FILE-023**: `src/mastra/agents/memory/tools/get-snapshot-history.ts` — Outil historique (nouveau)
- **FILE-024**: `src/mastra/agents/memory/tools/index.ts` — Index outils (modifié)
- **FILE-025**: `src/mastra/agents/memory/agent.ts` — Agent mémoire (modifié)
- **FILE-026**: `src/mastra/agents/memory/hooks/observation-hooks.ts` — Hooks observation (nouveau)
- **FILE-027**: `src/mastra/agents/memory/hooks/conversation-hooks.ts` — Hooks conversation (nouveau)
- **FILE-028**: `src/mastra/agents/memory/hooks/index.ts` — Index hooks (modifié)
- **FILE-029**: `src/mastra/agents/companion/agent.ts` — Agent principal (modifié)
- **FILE-030**: `src/mastra/instructions/companion-instructions.ts` — Instructions (modifié)
- **FILE-031**: `src/mastra/agents/memory/index.ts` — Entry point (modifié)

---

## 7. Testing

- **TEST-001**: Snapshot creation avec données valides → snapshot créé avec health score calculé
- **TEST-002**: Snapshot creation avec données invalides → erreur de validation Zod
- **TEST-003**: getLatestSnapshot retourne le plus récent
- **TEST-004**: getSnapshotHistory retourne les snapshots dans la plage de dates
- **TEST-005**: analyzeTrends avec 3+ snapshots → tendance calculée
- **TEST-006**: analyzeTrends avec <3 snapshots → "insufficient_data"
- **TEST-007**: calculateHealthScore avec tests échoués → score < 0.5
- **TEST-008**: calculateHealthScore avec tout vert → score > 0.8
- **TEST-009**: generateProjectRecap retourne un récap complet
- **TEST-010**: generateMultiProjectRecap agrège tous les projets
- **TEST-011**: upsertProfile crée ou met à jour le profil
- **TEST-012**: extractFromConversation extrait les candidats mémoire
- **TEST-013**: classifyCandidate identifie les types correctement
- **TEST-014**: shouldStore rejette les conversations non pertinentes
- **TEST-015**: observeAndRecordProject crée un snapshot via les hooks
- **TEST-016**: Le Memory Agent peut utiliser memory_observe_project
- **TEST-017**: Le Memory Agent peut utiliser memory_get_recap
- **TEST-018**: Le Companion peut déléguer l'observation au Memory Agent
- **TEST-019**: Nettoyage automatique des vieux snapshots (rétention)
- **TEST-020**: La politique de rétention respecte la limite configurée

---

## 8. Risks & Assumptions

- **RISK-001**: Le volume de snapshots peut devenir important → Mitigation: politique de rétention (garder 30 jours par défaut, configurable)
- **RISK-002**: L'observation dépend des outils disponibles du runtime → Mitigation: le système fonctionne en mode dégradé sans outils d'observation
- **RISK-003**: La pipeline conversation peut extraire du bruit → Mitigation: classification stricte + seuil de confiance
- **RISK-004**: Les tendances sur courte période peuvent être trompeuses → Mitigation: nécessiter au moins 3 snapshots avant de calculer une tendance
- **ASSUMPTION-001**: Le runtime fournit des outils d'observation (filesystem, git) — le compagnon les utilise quand disponibles
- **ASSUMPTION-002**: Le volume de projets suivis sera < 50 — suffisant pour SQLite
- **ASSUMPTION-003**: Les snapshots seront pris à la demande (pas en continu) — un scheduler peut être ajouté plus tard
- **ASSUMPTION-004**: L'utilisateur préfère les récaps en français — configurable via le profil

---

## 9. Workflow Complet du Compagnon (Après Implémentation)

```
UTILISATEUR: "Bonjour, qu'est-ce qui se passe avec mes projets ?"

COMPAGNON:
  1. → memory_get_profile (récupérer préférences utilisateur)
  2. → memory_get_recap (récupérer récap multi-projets)
  3. Présenter le récap:
     📋 Récap du 22 août 2026

     ┌─ Compagnon ─── 🟢 Sain ──────── 3 commits, 0 failing tests
     ├─ Novaris ───── 🟡 Attention ─── 2 tests échoués
     ├─ Memory ────── 🔴 Critique ──── Build échoué
     └─ Planner ───── 🟢 Sain ──────── 5 tests passent

     ⚠️ Alertes:
     - Memory: build échoué depuis le 20 août
     - Novaris: 2 tests en échec

     💡 Suggestions:
     - Relancer le build de Memory après correction
     - Vérifier les tests Novaris

COMPAGNO fait un travail:
  1. → retrieveRelevantMemories (contexte avant tâche)
  2. Exécute la tâche
  3. → memory_observe_project (snapshot post-tâche)
  4. → extractTaskMemories (enregistrer l'expérience)
  5. Présenter le résultat

UTILISATEUR: "Rappelle-moi, on avait choisi quoi pour le search ?"

COMPAGNON:
  1. → memory_search(query="search choix")
  2. Retrouve: "Decision: Novaris utilise Typesense (choisi le 15 mars)"
  3. Répond avec la décision et son contexte
```

---

## 10. Intégration avec les Agents Spécialisés

La mémoire professionnelle est le **système nerveux central** qui connecte tous les agents spécialisés. Chaque agent interroge et enrichit la mémoire.

```
┌──────────────────────────────────────────────────────────────┐
│                    FLUX MÉMOIRE × AGENTS                     │
│                                                               │
│  GITHUB AGENT ──→ Memory: "quel repo pour ce projet ?"       │
│  GITHUB AGENT ──→ Memory: "quel était le contexte de l'issue"│
│  GITHUB AGENT ──→ Memory: stocker décision de merge          │
│                                                               │
│  PLANE AGENT  ──→ Memory: "quel était l'objectif original ?" │
│  PLANE AGENT  ──→ Memory: "pourquoi cette tâche est bloquée" │
│  PLANE AGENT  ──→ Memory: stocker progression projet         │
│                                                               │
│  OUTLINE AGENT ──→ Memory: "quelle doc existe déjà ?"        │
│  OUTLINE AGENT ──→ Memory: "publie cette décision dans Outline"
│  OUTLINE AGENT ──→ Memory: stocker lien doc publiée          │
│                                                               │
│  PLANNER      ──→ Memory: "contraintes et décisions passées" │
│  PLANNER      ──→ Memory: stocker le plan validé             │
└──────────────────────────────────────────────────────────────┘
```

### Capacités mémoire pour chaque agent

| Agent | Lit de la mémoire | Écrit dans la mémoire |
|-------|-------------------|----------------------|
| GitHub | Contexte projet, conventions, décisions | Issues créées, merges, décisions techniques |
| Plane | Objectifs, priorités, historique tâches | Progression, blocages, résolutions |
| Outline | Architecture, procédures, conventions | Liens documents publiés |
| Planner | Contraintes, échecs passés, stack technique | Plans validés |
| Companion | Tout (orchestrateur) | Tout (via hooks) |

---

## 11. Ordre d'Implémentation Recommandé

```
Phase 1 (Fondations)     → 2-3 jours
  └── Types, schémas, tables SQL

Phase 2 (Repositories)   → 1-2 jours
  └── CRUD pour les nouvelles tables

Phase 3 (Services)       → 3-4 jours
  └── Logique métier: snapshot, tendances, récap, profil, pipeline

Phase 4 (Tools)          → 1-2 jours
  └── Outils exposés au Memory Agent

Phase 5 (Hooks)          → 1-2 jours
  └── Activation des hooks + nouvelles instructions

Phase 6 (Tests)          → 2-3 jours
  └── Tests unitaires + intégration + validation

TOTAL: ~10-16 jours

PARALLÈLE avec les agents spécialisés:
- GitHub Agent:    plan/feature-github-agent-1.md   → ~8-12 jours
- Plane Agent:     plan/feature-plane-agent-1.md    → ~8-12 jours
- Outline Agent:   plan/feature-outline-agent-1.md  → ~8-12 jours

ORDRE RECOMMANDÉ:
1. Mémoire professionnelle (fondations pour tous les agents)
2. GitHub Agent (le plus utilisé en dev daily)
3. Plane Agent (suivi projet)
4. Outline Agent (documentation)

TOTAL SYSTÈME: ~30-40 jours
```
