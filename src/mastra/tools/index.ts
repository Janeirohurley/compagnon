import { memoryHooksTool } from './memory-hooks-tool';
import { dateTimeTool } from './date-time-tool';
import {
  deleteProjectFileTool,
  editProjectFileTool,
  listProjectFilesTool,
  readProjectFileTool,
  writeProjectFileTool,
} from './project-file-tools';
import { companionFoundationTool } from './companion-foundation-tool';
// Memory tools are now in agents/memory module
import {
  memorySearchTool,
  memoryRememberTool,
  memoryUpdateTool,
  memoryForgetTool,
  memoryRecordEpisodeTool,
  memoryRecordDecisionTool,
  memoryGetProcedureTool,
  memoryUpdateProcedureTool,
  memoryVerifyTool,
  memoryGetTool,
  memoryListTool,
  memoryRetrieveContextTool,
  memoryExtractFactsTool,
  memoryConsolidateTool,
  memoryFindStaleTool,
  memoryArchiveStaleTool,
} from '../agents/memory/tools';

export function getCompanionTools() {
  return {
    companion_foundation: companionFoundationTool,
    memory_hooks: memoryHooksTool,
    date_time: dateTimeTool,

    list_project_files: listProjectFilesTool,
    read_project_file: readProjectFileTool,
    write_project_file: writeProjectFileTool,
    edit_project_file: editProjectFileTool,
    delete_project_file: deleteProjectFileTool,

    // Memory tools
    memory_search: memorySearchTool,
    memory_remember: memoryRememberTool,
    memory_update: memoryUpdateTool,
    memory_forget: memoryForgetTool,
    memory_record_episode: memoryRecordEpisodeTool,
    memory_record_decision: memoryRecordDecisionTool,
    memory_get_procedure: memoryGetProcedureTool,
    memory_update_procedure: memoryUpdateProcedureTool,
    memory_verify: memoryVerifyTool,
    memory_get: memoryGetTool,
    memory_list: memoryListTool,
    memory_retrieve_context: memoryRetrieveContextTool,
    memory_extract_facts: memoryExtractFactsTool,
    memory_consolidate: memoryConsolidateTool,
    memory_find_stale: memoryFindStaleTool,
    memory_archive_stale: memoryArchiveStaleTool,
  };
}