import { archiveMemoryById, deleteMemoryById } from "../repositories/memory-repository";

export async function forgetMemory(id: string): Promise<void> {
  await archiveMemoryById(id);
}

export async function deleteMemory(id: string): Promise<void> {
  await deleteMemoryById(id);
}
