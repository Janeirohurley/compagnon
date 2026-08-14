// Database schema for memory subsystem

export const SQL_SCHEMA = `
-- Semantic Memories
CREATE TABLE IF NOT EXISTS semantic_memories (
  id TEXT PRIMARY KEY,
  scope TEXT NOT NULL CHECK (scope IN ('global', 'user', 'organization', 'project', 'repository', 'task')),
  scope_id TEXT,
  subject TEXT NOT NULL,
  predicate TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  source_type TEXT NOT NULL CHECK (source_type IN ('user', 'conversation', 'file', 'repository', 'tool', 'agent')),
  source_reference TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_used_at TEXT,
  last_verified_at TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stale', 'deprecated', 'superseded', 'archived')),
  use_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_semantic_memories_scope ON semantic_memories(scope, scope_id);
CREATE INDEX IF NOT EXISTS idx_semantic_memories_status ON semantic_memories(status);
CREATE INDEX IF NOT EXISTS idx_semantic_memories_subject ON semantic_memories(subject);

-- Episodes
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY,
  project TEXT,
  repository TEXT,
  task TEXT,
  trigger TEXT NOT NULL,
  observations TEXT NOT NULL,
  actions TEXT NOT NULL,
  outcome TEXT NOT NULL,
  success INTEGER NOT NULL,
  lessons TEXT,
  tools_used TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_episodes_project ON episodes(project);
CREATE INDEX IF NOT EXISTS idx_episodes_repository ON episodes(repository);
CREATE INDEX IF NOT EXISTS idx_episodes_created ON episodes(created_at);

-- Procedures
CREATE TABLE IF NOT EXISTS procedures (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL,
  prerequisites TEXT NOT NULL,
  steps TEXT NOT NULL,
  failure_modes TEXT,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0.5,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_procedures_name ON procedures(name);

-- Decisions
CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  project TEXT,
  repository TEXT,
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  alternatives TEXT NOT NULL,
  decision TEXT NOT NULL,
  rationale TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'accepted' CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded')),
  superseded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decisions_project ON decisions(project);
CREATE INDEX IF NOT EXISTS idx_decisions_repository ON decisions(repository);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);

-- Memory Conflicts
CREATE TABLE IF NOT EXISTS memory_conflicts (
  id TEXT PRIMARY KEY,
  memory_a_id TEXT NOT NULL,
  memory_b_id TEXT NOT NULL,
  memory_a_excerpt TEXT NOT NULL,
  memory_b_excerpt TEXT NOT NULL,
  reason TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  resolution TEXT NOT NULL DEFAULT 'pending' CHECK (resolution IN ('pending', 'resolved_a', 'resolved_b', 'dismissed')),
  resolved_at TEXT,
  FOREIGN KEY (memory_a_id) REFERENCES semantic_memories(id),
  FOREIGN KEY (memory_b_id) REFERENCES semantic_memories(id)
);

CREATE INDEX IF NOT EXISTS idx_memory_conflicts_resolution ON memory_conflicts(resolution);
`;
