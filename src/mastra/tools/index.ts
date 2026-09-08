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
  };
}