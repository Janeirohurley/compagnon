import { findProcedureById, findProcedureByName, createProcedure as createProc, updateProcedureById } from "../repositories/procedure-repository";
import type { ProcedureInput, UpdateProcedureInput, Procedure } from "../domain/types";

export async function getProcedure(id: string): Promise<Procedure | null> {
  return findProcedureById(id);
}

export async function getProcedureByName(name: string): Promise<Procedure | null> {
  return findProcedureByName(name);
}

export async function createProcedure(input: ProcedureInput): Promise<Procedure> {
  return createProc(input);
}

export async function updateProcedure(id: string, input: UpdateProcedureInput): Promise<Procedure> {
  const updated = await updateProcedureById(id, input);
  if (!updated) throw new Error("Procedure not found");
  return updated;
}
