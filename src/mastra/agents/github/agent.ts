import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

import { companionModel } from "../../providers/omniroute";
import { githubInstructions } from "./github-instructions";
import { getGithubMcpTools } from "../../mcp/github-tools";
import { getAuthenticatedUser, listUserRepositories } from "./tools/user-info";

// Load MCP GitHub tools at startup
const mcpTools = await getGithubMcpTools();

// Tool: get the authenticated user's profile
const getMyProfileTool = createTool({
  id: "github_get_my_profile",
  description:
    "Get the authenticated GitHub user's profile. Uses the configured GITHUB_TOKEN.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    login: z.string(),
    name: z.string().nullable(),
    email: z.string().nullable(),
    publicRepos: z.number(),
    url: z.string(),
  }),
  execute: async () => {
    const user = await getAuthenticatedUser();
    if (!user) {
      return { login: "", name: null, email: null, publicRepos: 0, url: "" };
    }
    return user;
  },
});

// Tool: list my repositories
const listMyReposTool = createTool({
  id: "github_list_my_repos",
  description:
    "List all repositories for the authenticated GitHub user.",
  inputSchema: z.object({
    type: z
      .enum(["all", "owner", "public", "private", "forks"])
      .optional()
      .default("owner"),
    sort: z
      .enum(["created", "updated", "pushed", "full_name"])
      .optional()
      .default("updated"),
    perPage: z.number().int().positive().max(100).optional().default(30),
    page: z.number().int().positive().optional().default(1),
  }),
  outputSchema: z.array(
    z.object({
      name: z.string(),
      fullName: z.string(),
      description: z.string().nullable(),
      private: z.boolean(),
      language: z.string().nullable(),
      stars: z.number(),
      forks: z.number(),
      url: z.string(),
    })
  ),
  execute: async ({ type, sort, perPage, page }) => {
    const repos = await listUserRepositories({ type, sort, perPage, page });
    return repos ?? [];
  },
});

export const githubAgent = new Agent({
  id: "github",
  name: "GitHub Agent",
  description:
    "Compagnon's GitHub Agent. Handles all GitHub operations: issues, pull requests, code search, repository inspection, and account management. Knows the authenticated user's account via GITHUB_TOKEN.",
  model: companionModel,
  instructions: githubInstructions,
  memory: new Memory({
    options: {
      generateTitle: false,
    },
  }),
  maxSteps: 30,
  tools: {
    ...mcpTools,
    github_get_my_profile: getMyProfileTool,
    github_list_my_repos: listMyReposTool,
  } as Record<string, any>,
});
