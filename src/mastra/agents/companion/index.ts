// Main Agent (Compagnon) - Entry point
export { createCompanionAgent, delegateToMemoryAgent, generateWithMemory } from './agent';
export { buildCompanionMemory, getCompanionMemory, COMPANION_WORKING_MEMORY_TEMPLATE } from './memory';
export { resolveMemoryIds, retrieveContext, sanitizeForMemory, type MemoryIds } from './memory-context';