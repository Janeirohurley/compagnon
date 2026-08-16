// Decision Service - uses decision-repository
import {
  findDecisionById,
  findDecisionsByProject,
  findDecisionsByRepository,
  findAllDecisions,
  updateDecisionById,
  deleteDecisionById,
} from "../repositories/decision-repository";
import type { Decision } from "../domain/types";

export async function getDecision(id: string): Promise<Decision | null> {
  return findDecisionById(id);
}

export async function listDecisions(project?: string, repository?: string): Promise<Decision[]> {
  if (repository) {
    return findDecisionsByRepository(repository);
  }
  if (project) {
    return findDecisionsByProject(project);
  }
  return findAllDecisions();
}

export async function updateDecision(id: string, updates: Partial<Decision>): Promise<Decision | null> {
  return updateDecisionById(id, updates);
}

export async function deleteDecision(id: string): Promise<void> {
  await deleteDecisionById(id);
}
