import { getConnectionProvider, listConnectionProviders } from '../connections/connection-providers';
import { listConnections, upsertConnection } from '../connections/connection-store';
import { resolveWorkspaceFromRequest } from '../workspaces/resolve';

async function readJson(c: any) {
  return c.req.json();
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export const connectionsRoutes = [
  {
    path: '/connection-providers',
    method: 'GET' as const,
    handler: async () => json(listConnectionProviders()),
  },
  {
    path: '/connection-providers/:provider',
    method: 'GET' as const,
    handler: async (c: any) => {
      const provider = getConnectionProvider(c.req.param('provider'));
      return provider ? json(provider) : json({ error: 'Provider not found.' }, 404);
    },
  },
  {
    path: '/connections',
    method: 'GET' as const,
    handler: async (c: any) => {
      const provider = c.req.query('provider');
      const workspaceId = resolveWorkspaceFromRequest(c);
      return json(await listConnections(workspaceId, provider));
    },
  },
  {
    path: '/connections',
    method: 'POST' as const,
    handler: async (c: any) => {
      try {
        const body = await readJson(c);
        const connection = await upsertConnection({
          id: body.id,
          workspaceId: resolveWorkspaceFromRequest(c, body),
          provider: body.provider,
          name: body.name,
          config: body.config,
          secrets: body.secrets,
          enabled: body.enabled,
          isDefault: body.isDefault,
        });

        return json(connection);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Connection save failed.' }, 400);
      }
    },
  },
];
