import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const baseURL = process.env.OMNIROUTE_BASE_URL;
const apiKey = process.env.OMNIROUTE_API_KEY;
const modelId = process.env.OMNIROUTE_MODEL;

if (!baseURL) {
  throw new Error("OMNIROUTE_BASE_URL is not configured.");
}

if (!apiKey) {
  throw new Error("OMNIROUTE_API_KEY is not configured.");
}

if (!modelId) {
  throw new Error("OMNIROUTE_MODEL is not configured.");
}

const omniRouteFetch: typeof fetch = async (input, init) => {
  const headers = new Headers(init?.headers);

  headers.set("Accept", "application/json");

  return fetch(input, {
    ...init,
    headers,
  });
};

export const omniRoute = createOpenAICompatible({
  name: "omniroute",
  baseURL,
  apiKey,
  fetch: omniRouteFetch,
});

export const companionModel = omniRoute.chatModel(modelId);