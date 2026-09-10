import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

function findProjectRoot() {
  let current = process.cwd();

  while (current !== dirname(current)) {
    if (existsSync(resolve(current, 'package.json'))) {
      return current;
    }

    current = dirname(current);
  }

  return process.cwd();
}

const fileResultSchema = z.object({
  success: z.boolean(),
  path: z.string(),
  content: z.string().optional(),
  entries: z.array(z.string()).optional(),
  bytes: z.number().optional(),
  replacements: z.number().optional(),
  deleted: z.boolean().optional(),
  error: z.string().optional(),
});

/** Resolve a project-relative path under `root`, rejecting any escape. */
function projectPath(root: string, path: string) {
  const resolved = resolve(root, path);
  const rel = relative(root, resolved);

  if (rel.startsWith('..') || rel === '..' || resolve(rel) === rel) {
    throw new Error('Path must stay inside the project.');
  }

  return resolved;
}

function errorResult(path: string, error: unknown) {
  return {
    success: false,
    path,
    error: error instanceof Error ? error.message : 'File operation failed.',
  };
}

/**
 * Build the project-file tool set bound to a single root directory.
 *
 * Each tool closes over the root resolved at construction time (`cfg.projectPath`
 * of the workspace runtime, falling back to the repository root when absent) so
 * concurrent workspaces never race on a module-global root. All five tools keep
 * `requireApproval: true`.
 */
export function createProjectFileTools(projectRoot?: string) {
  const root = projectRoot ? resolve(projectRoot) : findProjectRoot();

  return {
    list_project_files: createTool({
      id: 'list_project_files',
      description: 'List files and folders inside this project after human approval.',
      requireApproval: true,
      inputSchema: z.object({
        path: z.string().optional().describe('Project-relative folder path to list. Defaults to project root.'),
      }),
      outputSchema: fileResultSchema,
      execute: async ({ path }) => {
        const targetPath = path || '.';

        try {
          const dirPath = projectPath(root, targetPath);
          const names = await readdir(dirPath);
          const entries = await Promise.all(
            names.map(async name => {
              const entryStat = await stat(resolve(dirPath, name));
              return `${name}${entryStat.isDirectory() ? '/' : ''}`;
            }),
          );

          return { success: true, path: targetPath, entries };
        } catch (error) {
          return errorResult(targetPath, error);
        }
      },
    }),

    read_project_file: createTool({
      id: 'read_project_file',
      description: 'Read a text file from this project after human approval.',
      requireApproval: true,
      inputSchema: z.object({
        path: z.string().describe('Project-relative file path to read.'),
      }),
      outputSchema: fileResultSchema,
      execute: async ({ path }) => {
        try {
          return {
            success: true,
            path,
            content: await readFile(projectPath(root, path), 'utf8'),
          };
        } catch (error) {
          return errorResult(path, error);
        }
      },
    }),

    write_project_file: createTool({
      id: 'write_project_file',
      description: 'Write a text file in this project after human approval. Creates parent folders if needed.',
      requireApproval: true,
      inputSchema: z.object({
        path: z.string().describe('Project-relative file path to write.'),
        content: z.string().describe('New file content.'),
      }),
      outputSchema: fileResultSchema,
      execute: async ({ path, content }) => {
        try {
          const filePath = projectPath(root, path);

          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, content, 'utf8');

          return {
            success: true,
            path,
            bytes: Buffer.byteLength(content),
          };
        } catch (error) {
          return errorResult(path, error);
        }
      },
    }),

    edit_project_file: createTool({
      id: 'edit_project_file',
      description: 'Edit a text file in this project by replacing text after human approval.',
      requireApproval: true,
      inputSchema: z.object({
        path: z.string().describe('Project-relative file path to edit.'),
        oldText: z.string().describe('Existing text to replace.'),
        newText: z.string().describe('Replacement text.'),
        replaceAll: z.boolean().optional().describe('Replace all matches. Defaults to false.'),
      }),
      outputSchema: fileResultSchema,
      execute: async ({ path, oldText, newText, replaceAll }) => {
        try {
          const filePath = projectPath(root, path);
          const content = await readFile(filePath, 'utf8');
          const replacements = replaceAll ? content.split(oldText).length - 1 : Number(content.includes(oldText));

          if (replacements === 0) {
            return { success: false, path, replacements: 0, error: 'oldText not found.' };
          }

          const nextContent = replaceAll ? content.split(oldText).join(newText) : content.replace(oldText, newText);
          await writeFile(filePath, nextContent, 'utf8');

          return { success: true, path, replacements };
        } catch (error) {
          return errorResult(path, error);
        }
      },
    }),

    delete_project_file: createTool({
      id: 'delete_project_file',
      description: 'Delete a file or folder from this project after human approval.',
      requireApproval: true,
      inputSchema: z.object({
        path: z.string().describe('Project-relative file or folder path to delete.'),
        recursive: z.boolean().optional().describe('Delete folders recursively. Defaults to false.'),
      }),
      outputSchema: fileResultSchema,
      execute: async ({ path, recursive }) => {
        try {
          await rm(projectPath(root, path), { recursive: recursive ?? false });

          return { success: true, path, deleted: true };
        } catch (error) {
          return errorResult(path, error);
        }
      },
    }),
  };
}