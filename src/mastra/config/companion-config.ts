import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface CompanionConfig {
  workspaceRoots: string[];
}

function getWorkspaceRoots(): string[] {
  const value = process.env.COMPANION_WORKSPACE_ROOTS|| "/home/projets/ai/compagnon/";

  if (!value) {
    throw new Error(
      'COMPANION_WORKSPACE_ROOTS is not configured.',
    );
  }

  const roots = value
    .split(',')
    .map((root) => root.trim())
    .filter(Boolean)
    .map((root) => resolve(root));

  if (roots.length === 0) {
    throw new Error(
      'COMPANION_WORKSPACE_ROOTS must contain at least one directory.',
    );
  }

  for (const root of roots) {
    if (!existsSync(root)) {
      throw new Error(
        `Configured workspace does not exist: ${root}`,
      );
    }
  }

  return roots;
}

export function getCompanionConfig(): CompanionConfig {
  return {
    workspaceRoots: getWorkspaceRoots(),
  };
}