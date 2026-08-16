import { findMemoryById } from "../repositories/memory-repository";
import type { SemanticMemory } from "../domain/types";

export async function getMemory(id: string): Promise<SemanticMemory | null> {
  return findMemoryById(id);
}
