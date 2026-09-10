// Provider Registry routes (TASK-008).
//
// Responses always go through `toPublicProvider` — encrypted API keys are
// never served. `probe` is a stateless connectivity check (8s timeout, no
// persistence). Provider mutations refresh the resolver cache so subsequent
// agent construction picks up the new defaults.
import { PROVIDER_REGISTRY } from "@mastra/core/llm";

import {
  getProvider,
  listProviders,
  probeModels,
  removeProvider,
  setDefaultProvider,
  toPublicProvider,
  upsertProvider,
} from "../providers/registry";
import { refreshProviderCache } from "../providers/resolve";

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

function nativeCatalog() {
  // Native providers come from Mastra's built-in registry (no code per vendor).
  return Object.keys(PROVIDER_REGISTRY);
}

async function readJson(c: any) {
  return c.req.json();
}

export const providerRoutes = [
  {
    path: "/model-providers",
    method: "GET" as const,
    handler: async () => {
      const providers = (await listProviders()).map(toPublicProvider);
      return json({ providers, native: nativeCatalog() });
    },
  },
  {
    path: "/model-providers/:id",
    method: "GET" as const,
    handler: async (c: any) => {
      const provider = await getProvider(c.req.param("id"));
      return provider ? json(toPublicProvider(provider)) : json({ error: "Provider not found." }, 404);
    },
  },
  {
    path: "/model-providers",
    method: "POST" as const,
    handler: async (c: any) => {
      try {
        const body = await readJson(c);
        const provider = await upsertProvider({
          ...body,
          id: body.id ?? body.providerId,
        });
        await refreshProviderCache();
        return json(toPublicProvider(provider));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Provider save failed." }, 400);
      }
    },
  },
  {
    path: "/model-providers/:id",
    method: "PATCH" as const,
    handler: async (c: any) => {
      try {
        const body = await readJson(c);
        const existing = await getProvider(c.req.param("id"));
        if (!existing) return json({ error: "Provider not found." }, 404);
        const provider = await upsertProvider({
          id: existing.id,
          providerId: existing.providerId,
          kind: existing.kind,
          baseUrl: existing.baseUrl,
          ...body,
        });
        await refreshProviderCache();
        return json(toPublicProvider(provider));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Provider update failed." }, 400);
      }
    },
  },
  {
    path: "/model-providers/:id",
    method: "DELETE" as const,
    handler: async (c: any) => {
      try {
        await removeProvider(c.req.param("id"));
        await refreshProviderCache();
        return json({ ok: true });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Provider delete failed." }, 400);
      }
    },
  },
  {
    path: "/model-providers/:id/default",
    method: "POST" as const,
    handler: async (c: any) => {
      try {
        const body = await readJson(c);
        const provider = await setDefaultProvider(c.req.param("id"), body.capability);
        await refreshProviderCache();
        return json(toPublicProvider(provider));
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Set default failed." }, 400);
      }
    },
  },
  {
    path: "/model-providers/probe",
    method: "POST" as const,
    handler: async (c: any) => {
      try {
        const body = await readJson(c);
        if (!body.baseUrl || typeof body.baseUrl !== "string") {
          return json({ error: "Missing required field: baseUrl" }, 400);
        }
        const result = await probeModels(body.baseUrl, body.apiKey);
        return json(result);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Probe failed." }, 400);
      }
    },
  },
];