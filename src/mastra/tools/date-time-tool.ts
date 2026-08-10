import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const dateTimeTool = createTool({
  id: 'date_time',
  description: 'Get the current date and time.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    iso: z.string(),
    locale: z.string(),
  }),
  execute: async () => {
    const now = new Date();

    return {
      iso: now.toISOString(),
      locale: now.toLocaleString(),
    };
  },
});
