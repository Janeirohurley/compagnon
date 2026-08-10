import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
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

export const companionFoundationTool = createTool({
  id: 'companion_foundation',
  description:
    'Load Companion foundational self-knowledge: identity, purpose, capabilities, boundaries, environment, behavior, and uncertainty rules.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    path: z.string(),
    content: z.string(),
  }),
  execute: async () => {
    const path = '.agents/skills/companion-foundation/SKILL.md';
    const absolutePath = resolve(findProjectRoot(), path);

    return {
      path,
      content: await readFile(absolutePath, 'utf8'),
    };
  },
});
