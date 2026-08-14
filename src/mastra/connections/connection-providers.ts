export type ConnectionField = {
  name: string;
  label: string;
  type: 'text' | 'url' | 'password';
  defaultValue?: string;
  secret?: boolean;
};

export type ConnectionProviderDefinition = {
  id: string;
  label: string;
  description: string;
  fields: ConnectionField[];
  capabilities: string[];
};

export const PLANE_CAPABILITIES = [
  'plane.list_projects',
  'plane.list_states',
  'plane.list_issues',
  'plane.get_issue',
  'plane.search_issues',
  'plane.create_issue',
  'plane.update_issue',
  'plane.list_issue_comments',
  'plane.add_issue_comment',
];

export const connectionProviders: Record<string, ConnectionProviderDefinition> = {
  plane: {
    id: 'plane',
    label: 'Plane',
    description: 'Plane projects, work items, states, and comments.',
    fields: [
      { name: 'baseUrl', label: 'Base URL', type: 'url', defaultValue: 'https://api.plane.so' },
      { name: 'workspaceSlug', label: 'Workspace slug', type: 'text' },
      { name: 'apiKey', label: 'API key', type: 'password', secret: true },
    ],
    capabilities: PLANE_CAPABILITIES,
  },
};

export function listConnectionProviders() {
  return Object.values(connectionProviders);
}

export function getConnectionProvider(provider: string) {
  return connectionProviders[provider] ?? null;
}

export function connectionRequestUi(provider: string) {
  const definition = getConnectionProvider(provider);
  if (!definition) return null;

  return {
    type: 'connection_request',
    provider: definition.id,
    title: `Connect ${definition.label}`,
    fields: definition.fields,
  };
}
