import { MCPClient } from '@mastra/mcp';

/**
 * Official Plane MCP server (makeplane/plane-mcp-server), run locally via npx (stdio).
 *
 * Alternative: use the hosted server instead of spawning a local process:
 *   plane: { url: new URL('https://mcp.plane.so/http/api-key/mcp'),
 *            requestInit: { headers: { Authorization: `Bearer ${process.env.PLANE_API_KEY}`,
 *                                       'X-Workspace-slug': process.env.PLANE_WORKSPACE_SLUG } } }
 * Prefer the local stdio version while you're still verifying behavior — fewer moving
 * parts, easier to kill if something goes wrong.
 */
export function createPlaneMcp(): MCPClient {
  const apiKey = process.env.PLANE_API_KEY;
  const workspaceSlug = process.env.PLANE_WORKSPACE_SLUG;
  const baseUrl = process.env.PLANE_BASE_URL || 'https://api.plane.so';

  if (!apiKey) {
    throw new Error(
      '[Compagnon] Plane MCP cannot start: PLANE_API_KEY is not configured.',
    );
  }

  if (!workspaceSlug) {
    throw new Error(
      '[Compagnon] Plane MCP cannot start: PLANE_WORKSPACE_SLUG is not configured.',
    );
  }

  try {
    new URL(baseUrl);
  } catch (error) {
    throw new Error(
      `[Compagnon] Plane MCP cannot start: invalid PLANE_BASE_URL.`,
      { cause: error },
    );
  }

  try {
    const client = new MCPClient({
      id: 'compagnon-plane',
      servers: {
        plane: {
          command: 'npx',
          args: ['-y', '@makeplane/plane-mcp-server'],
          env: {
            PLANE_API_KEY: apiKey,
            PLANE_API_HOST_URL: baseUrl,
            PLANE_WORKSPACE_SLUG: workspaceSlug,
            NODE_TLS_REJECT_UNAUTHORIZED: process.env.NODE_TLS_REJECT_UNAUTHORIZED || '0',
          },
          // Cohérent avec la skill policy-safety : toute action passe par une
          // confirmation humaine par défaut. Une fois les tools réellement en lecture
          // seule identifiés (list_projects, list_issues, etc.), remplacer par une
          // fonction de classification plutôt que ce booléen global.
          requireToolApproval: true,
        },
      },
    });

    console.info(`[Compagnon] Plane MCP configured successfully: ${baseUrl}`);

    return client;
  } catch (error: any) {
    console.error('[Compagnon] Failed to initialize Plane MCP.', error.message);

    throw new Error(
      '[Compagnon] Unable to initialize Plane MCP. Check the Plane URL, workspace slug, and API key configuration.',
      { cause: error.message },
    );
  }
}