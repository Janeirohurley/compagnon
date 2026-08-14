import {
  getConnectionWithSecrets,
  getDefaultConnectionWithSecrets,
  updateConnectionStatus,
} from './connection-store';
import { connectionRequestUi, PLANE_CAPABILITIES } from './connection-providers';

export function planeNeedsConnectionResult() {
  return {
    success: false,
    reason: 'needs_connection',
    provider: 'plane',
    error: 'Plane connection is not configured.',
    ui: connectionRequestUi('plane'),
  };
}

export async function getPlaneConnection(connectionId?: string) {
  const connection = connectionId
    ? await getConnectionWithSecrets(connectionId)
    : await getDefaultConnectionWithSecrets('plane');

  if (!connection || !connection.enabled) return null;

  const apiKey = String(connection.secrets.apiKey || '');
  const workspaceSlug = String(connection.config.workspaceSlug || '');
  const baseUrl = String(connection.config.baseUrl || 'https://api.plane.so').replace(/\/$/, '');

  if (!apiKey || !workspaceSlug || !baseUrl) return null;

  return { connection, apiKey, workspaceSlug, baseUrl };
}

export async function planeRequest(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown,
  connectionId?: string,
) {
  const plane = await getPlaneConnection(connectionId);

  if (!plane) return planeNeedsConnectionResult();

  try {
    const response = await fetch(`${plane.baseUrl}${path}`, {
      method,
      headers: {
        'X-API-Key': plane.apiKey,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    const data = text ? JSON.parse(text) : undefined;

    if (!response.ok) {
      const message =
        typeof data?.detail === 'string'
          ? data.detail
          : typeof data?.message === 'string'
            ? data.message
            : `Plane API request failed with status ${response.status}.`;

      await updateConnectionStatus(plane.connection.id, 'error', plane.connection.capabilities, message);

      return { success: false, status: response.status, error: message, data };
    }

    await updateConnectionStatus(plane.connection.id, 'connected', PLANE_CAPABILITIES, null);

    return { success: true, status: response.status, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Plane API request failed.';
    await updateConnectionStatus(plane.connection.id, 'error', plane.connection.capabilities, message);
    return { success: false, error: message };
  }
}

export async function testPlaneConnection(connectionId: string) {
  const plane = await getPlaneConnection(connectionId);
  if (!plane) return planeNeedsConnectionResult();

  const result = await planeRequest(
    'GET',
    `/api/v1/workspaces/${encodeURIComponent(plane.workspaceSlug)}/projects/?per_page=1`,
    undefined,
    connectionId,
  );

  if (result.success) {
    await updateConnectionStatus(connectionId, 'connected', PLANE_CAPABILITIES, null);
  }

  return result;
}

export function planeWorkspacePath(workspaceSlug: string, path: string) {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceSlug)}${path}`;
}

export async function getPlaneWorkspacePath(path: string, connectionId?: string) {
  const plane = await getPlaneConnection(connectionId);
  if (!plane) return null;
  return planeWorkspacePath(plane.workspaceSlug, path);
}
