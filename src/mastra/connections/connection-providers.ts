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

// Connection providers will be added here as needed
export const connectionProviders: Record<string, ConnectionProviderDefinition> = {};

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
