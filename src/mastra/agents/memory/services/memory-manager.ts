// Memory Manager - Facade that aggregates all memory services
import type { IMemoryManager } from "../domain/contracts";
import { searchMemories } from "./search";
import { rememberMemory } from "./remember";
import { listMemories } from "./list";
import { getMemory } from "./get";
import { updateMemory, supersedeMemory } from "./update";
import { forgetMemory, deleteMemory } from "./forget";
import { recordEpisode } from "./record-episode";
import { recordDecision } from "./record-decision";
import { getProcedure, getProcedureByName, createProcedure, updateProcedure } from "./procedures";
import { detectConflicts, getPendingConflicts, resolveConflict } from "./conflict";
import { verifyMemory } from "./verify";
import { consolidateEpisodes, findStaleMemories, archiveStaleMemories } from "./consolidation";
import { listEpisodes, getEpisode, deleteEpisode } from "./episodes";
import { listDecisions, getDecision, updateDecision, deleteDecision } from "./decisions";
import { listAllProcedures, deleteProcedure } from "./procedures-list";

export const memoryManager: IMemoryManager = {
  search: searchMemories,
  remember: rememberMemory,
  listMemories,
  getMemory,
  update: updateMemory,
  forget: forgetMemory,
  deleteMemory,
  recordEpisode,
  recordDecision,
  getProcedure,
  getProcedureByName,
  createProcedure,
  updateProcedure,
  detectConflicts,
  verifyMemory,
  listEpisodes,
  getEpisode,
  deleteEpisode,
  listDecisions,
  getDecision,
  updateDecision,
  deleteDecision,
  supersedeMemory,
  getPendingConflicts,
  resolveConflict,
  consolidateEpisodes,
  findStaleMemories,
  archiveStaleMemories,
  listAllProcedures,
  deleteProcedure,
};
