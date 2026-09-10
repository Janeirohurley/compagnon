import { memoryHooksTool } from './memory-hooks-tool';
import { dateTimeTool } from './date-time-tool';
import { createProjectFileTools } from './project-file-tools';
import { companionFoundationTool } from './companion-foundation-tool';

/**
 * Companion tool set. Project-file tools are built per workspace: pass the
 * workspace's `projectPath` (undefined keeps the repository root) so every
 * runtime closes over its own root.
 */
export function getCompanionTools(projectRoot?: string) {
  return {
    companion_foundation: companionFoundationTool,
    memory_hooks: memoryHooksTool,
    date_time: dateTimeTool,

    ...createProjectFileTools(projectRoot),
  };
}