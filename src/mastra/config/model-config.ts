export function getCompanionModelConfig() {
  return {
    providerId: process.env.OMNIROUTE_PROVIDER_ID || 'omniroute',
    modelId: process.env.OMNIROUTE_MODEL || 'gpt-4o-mini',
    url: process.env.OMNIROUTE_BASE_URL,
    apiKey: process.env.OMNIROUTE_API_KEY,
  };
}