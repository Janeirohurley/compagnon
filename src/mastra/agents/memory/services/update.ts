import { findMemoryById, updateMemoryById, supersedeMemoryById, createMemory } from "../repositories/memory-repository";
import type { SemanticMemory, UpdateMemoryInput, RememberInput } from "../domain/types";

export async function updateMemory(id: string, input: UpdateMemoryInput): Promise<SemanticMemory> {
  const existing = await findMemoryById(id);
  if (!existing) throw new Error("Memory not found");

  const updated = await updateMemoryById(id, input);
  if (!updated) throw new Error("Memory not found");

  return updated;
}

export async function supersedeMemory(id: string, newMemory: RememberInput): Promise<SemanticMemory> {
  const existing = await findMemoryById(id);
  if (!existing) throw new Error("Memory not found");

  // Mark old memory as superseded
  await supersedeMemoryById(id);

  // Create new memory with same scope
  const created = await createMemory({
    id: crypto.randomUUID(),
    scope: newMemory.scope,
    scopeId: newMemory.scopeId,
    subject: newMemory.subject,
    predicate: newMemory.predicate,
    value: newMemory.value,
    confidence: newMemory.confidence,
    source: newMemory.source,
    status: "active",
    useCount: 0,
  });

  return created;
}
