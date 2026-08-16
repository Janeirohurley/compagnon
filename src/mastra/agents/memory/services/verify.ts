import { getMemory } from "./get";
import { updateMemory } from "./update";
import type { SemanticMemory } from "../domain/types";

export async function verifyMemory(id: string, verifiedValue: string): Promise<SemanticMemory> {
  const memory = await getMemory(id);
  if (!memory) throw new Error("Memory not found");
  
  if (memory.value !== verifiedValue) {
    // Mark old as stale, but we need the new value to supersede
    await updateMemory(id, { status: "stale" });
  }
  
  return { ...memory, status: memory.value === verifiedValue ? memory.status : "stale" };
}
