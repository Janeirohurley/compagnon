// Unified Mastra Memory for Compagnon.
//
// Single source of truth: LibSQLStore (message history + working memory) +
// LibSQLVector (semantic recall) + observational memory (long-term, bounded
// context). The agent previously relied on `new Memory({options})` with no
// storage/vector, plus a separate custom semantic subsystem; this factory is
// the only way the app builds its memory.
import { Memory } from "@mastra/memory";
import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import {
  getDefaultChatRef,
  getDefaultEmbeddingRef,
  resolveChatModel,
  resolveEmbeddingModel,
} from "../../providers/resolve";

const chatModel = resolveChatModel(getDefaultChatRef());
const embeddingModel = resolveEmbeddingModel(getDefaultEmbeddingRef());

const DB_URL = process.env.TURSO_DATABASE_URL || "file:./mastra.db";
const DB_TOKEN = process.env.TURSO_AUTH_TOKEN;

/**
 * Working memory template: the always-available persistent blocks the agent can
 * read/update. Facts, preferences, decisions and procedures are stored here as
 * labeled markdown blocks (resource-scoped).
 */
export const COMPANION_WORKING_MEMORY_TEMPLATE = `# Faits
- fait: | source:

# Préférences
- documentation-backend: 
- pret-de-repondre: 

# Décisions
- décision: | contexte: | raison: | alternative:

# Procédures
- procédure: | but: | étapes: | échecs:`;

let _memory: Memory | undefined;

/**
 * Shared LibSQL store backing the companion memory. Exported so the chat
 * routes can read/write threads and messages of the *same* database the agent
 * persists to (single instance, one connection pool).
 */
export const companionStorage = new LibSQLStore({
  id: "companion-memory-storage",
  url: DB_URL,
  authToken: DB_TOKEN,
});

export function buildCompanionMemory(): Memory {
  return new Memory({
    storage: companionStorage,
    vector: new LibSQLVector({
      id: "companion-memory-vector",
      url: DB_URL,
      authToken: DB_TOKEN,
    }),
    embedder: embeddingModel,
    options: {
      lastMessages: 20,
      semanticRecall: {
        topK: 4,
        messageRange: { before: 1, after: 1 },
        scope: "resource",
      },
      workingMemory: {
        enabled: true,
        scope: "resource",
        template: COMPANION_WORKING_MEMORY_TEMPLATE,
      },
      observationalMemory: {
        model: chatModel,
        temporalMarkers: true,
      },
      generateTitle: false,
    },
  });
}

/** Lazy singleton so the whole app shares one Memory instance. */
export function getCompanionMemory(): Memory {
  if (!_memory) {
    _memory = buildCompanionMemory();
  }
  return _memory;
}