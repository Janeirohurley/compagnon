// Tool catalogue endpoints (feature-tools-dynamic-workspace-1).
//
// Backs the UI Tools & Plugins page with per-workspace data. No delete
// operations exist: servers/plugins are enabled/disabled (REQ-002).
import { listConnections, setConnectionEnabled } from '../connections/connection-store';
import { listWorkspaceServers, setServerEnabled, updateServerConfig, upsertServer } from '../mcp/mcp-store';
import { hasValidOAuthTokens, connectOAuthServer, disconnectOAuthServer } from '../mcp';
import { loadMcpServersConfig } from '../mcp/config';
import { resolveWorkspaceFromRequest } from '../workspaces/resolve';

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function toPluginPublic(connection: {
  id: string;
  provider: string;
  name: string;
  enabled: boolean;
  status: string;
  capabilities: string[];
  updatedAt: string | null;
}) {
  return {
    id: connection.id,
    provider: connection.provider,
    name: connection.name,
    enabled: connection.enabled,
    status: connection.status,
    capabilities: connection.capabilities,
    updatedAt: connection.updatedAt,
  };
}

export const toolsRoutes = [
  {
    path: '/tools',
    method: 'GET' as const,
    handler: async (c: any) => {
      const workspaceId = resolveWorkspaceFromRequest(c);
      const [servers, connections, config] = await Promise.all([
        listWorkspaceServers(workspaceId),
        listConnections(workspaceId),
        loadMcpServersConfig(),
      ]);
      const authByServerId = new Map(config.servers.map((s) => [s.id, Boolean(s.auth)]));
      const authorizedStatuses = await Promise.all(
        servers.map(async (server) =>
          authByServerId.get(server.id)
            ? { [server.id]: await hasValidOAuthTokens(workspaceId, server.id) }
            : null,
        ),
      );
      const authorized = Object.assign({}, ...authorizedStatuses.filter(Boolean)) as Record<string, boolean>;
      return json({
        servers: servers.map((server) => ({
          id: server.id,
          name: server.name,
          kind: server.kind,
          type: server.type,
          url: server.url,
          command: server.command,
          args: server.args,
          agents: server.agents,
          requiredEnv: server.requiredEnv,
          requiredEnvMissing: server.requiredEnv.filter((env) => !process.env[env]),
          env: server.env,
          secretKeys: server.secretKeys,
          auth: Boolean(authByServerId.get(server.id)),
          authorized: Boolean(authorized[server.id]),
          enabled: server.enabled,
          updatedAt: server.updatedAt,
        })),
        plugins: connections.map((connection) =>
          toPluginPublic({
            id: connection.id,
            provider: connection.provider,
            name: connection.name,
            enabled: connection.enabled,
            status: connection.status,
            capabilities: connection.capabilities,
            updatedAt: connection.updatedAt,
          }),
        ),
      });
    },
  },
  {
    path: '/tools/mcp',
    method: 'POST' as const,
    handler: async (c: any) => {
      try {
        const body = await c.req.json();
        if (!body.name || !body.type) {
          return json({ error: 'name and type are required.' }, 400);
        }
        const type = body.type === 'url' ? 'url' : 'stdio';
        if (type === 'url' && !body.url) {
          return json({ error: 'url is required for a url server.' }, 400);
        }
        if (type === 'stdio' && !body.command) {
          return json({ error: 'command is required for a stdio server.' }, 400);
        }
        const server = await upsertServer({
          id: body.id,
          workspaceId: resolveWorkspaceFromRequest(c, body),
          type,
          name: body.name,
          url: body.url,
          command: body.command,
          args: body.args,
          headers: body.headers,
          agents: body.agents,
          requiredEnv: body.requiredEnv,
          env: body.env,
          secrets: body.secrets,
        });
        return json(server, 201);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Server creation failed.' }, 400);
      }
    },
  },
  {
    path: '/tools/mcp/:serverId/connect',
    method: 'POST' as const,
    handler: async (c: any) => {
      try {
        const workspaceId = resolveWorkspaceFromRequest(c);
        const serverId = c.req.param('serverId');
        const tools = await connectOAuthServer(workspaceId, serverId);
        const toolCount = Object.keys(tools).length;
        await setServerEnabled(workspaceId, serverId, true).catch(() => undefined);
        return json({
          connected: toolCount > 0,
          toolCount,
          message:
            toolCount > 0
              ? `Connected (${toolCount} MCP tools available).`
              : 'Authorization completed but no tools were returned. Please check permissions.',
        });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Connection failed.' }, 400);
      }
    },
  },
  {
    path: '/tools/mcp/:serverId/disconnect',
    method: 'POST' as const,
    handler: async (c: any) => {
      try {
        const workspaceId = resolveWorkspaceFromRequest(c);
        const serverId = c.req.param('serverId');
        const disconnected = await disconnectOAuthServer(workspaceId, serverId);
        return json({ disconnected });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Disconnection failed.' }, 400);
      }
    },
  },
  {
    path: '/tools/mcp/:serverId',
    method: 'PATCH' as const,
    handler: async (c: any) => {
      try {
        const body = await c.req.json();
        const patch = typeof body.config === 'object' && body.config !== null ? body.config : undefined;
        if (typeof body.enabled !== 'boolean' && !patch) {
          return json({ error: 'enabled (boolean) or config (object) is required.' }, 400);
        }
        const workspaceId = resolveWorkspaceFromRequest(c);

        let server = typeof body.enabled === 'boolean'
          ? await setServerEnabled(workspaceId, c.req.param('serverId'), body.enabled)
          : null;

        if (patch) {
          server = await updateServerConfig(workspaceId, c.req.param('serverId'), {
            name: patch.name,
            url: patch.url,
            command: patch.command,
            args: patch.args,
            agents: patch.agents,
            env: patch.env,
            secrets: patch.secrets,
          });
        }

        if (!server) {
          return json({ error: 'Server not found.' }, 404);
        }
        return json(server);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Server update failed.' }, 400);
      }
    },
  },
  {
    path: '/tools/plugins/:connectionId',
    method: 'PATCH' as const,
    handler: async (c: any) => {
      try {
        const body = await c.req.json();
        if (typeof body.enabled !== 'boolean') {
          return json({ error: 'enabled (boolean) is required.' }, 400);
        }
        const workspaceId = resolveWorkspaceFromRequest(c);
        const connection = await setConnectionEnabled(c.req.param('connectionId'), body.enabled, workspaceId);
        if (!connection) {
          return json({ error: 'Plugin not found.' }, 404);
        }
        return json(toPluginPublic(connection));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : 'Plugin update failed.' }, 400);
      }
    },
  },
];