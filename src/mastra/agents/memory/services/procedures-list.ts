// Procedure Service - additional operations from procedure-repository
import {
  findAllProcedures,
  deleteProcedureById,
} from "../repositories/procedure-repository";
import type { Procedure } from "../domain/types";

export async function listAllProcedures(): Promise<Procedure[]> {
  return findAllProcedures();
}

export async function deleteProcedure(id: string): Promise<void> {
  await deleteProcedureById(id);
}
