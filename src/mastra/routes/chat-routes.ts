import { handleChatStream } from "@mastra/ai-sdk";
import type { Mastra } from "@mastra/core/mastra";
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/request-context";
import type { MastraDBMessage } from "@mastra/core/agent";
import { resolveMemoryIds } from "../agents/companion/memory-context";
import { companionStorage, getCompanionMemory } from "../agents/companion/memory";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";

const MASTRA_MEMORY_KEY = "MastraMemory";

/** Memory domain of the shared composite store that backs the agent. */
async function memoryStore() {
  const store = await companionStorage.getStore("memory");
  if (!store) throw new Error("Memory storage domain is not configured");
  return store;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** Serialize a stored thread into the shape the UI consumes. */
function threadToJson(thread: { id: string; title?: string; resourceId?: string | null; createdAt?: Date | null; updatedAt?: Date | null }) {
  return {
    id: thread.id,
    title: thread.title ?? "",
    resourceId: thread.resourceId ?? null,
    createdAt: thread.createdAt ? thread.createdAt.toISOString() : null,
    updatedAt: thread.updatedAt ? thread.updatedAt.toISOString() : null,
  };
}

/**
 * Extract the plain conversational text of a persisted message: skips tool
 * invocations, reasoning and step markers. Content can be a V2 parts object,
 * a V1 JSON string, or a plain string.
 */
function extractMessageText(message: MastraDBMessage): string {
  const content = message.content as unknown;
  if (typeof content === "string") return content;
  if (content && typeof content === "object") {
    const c = content as { parts?: Array<{ type: string; text?: string }>; content?: unknown };
    if (Array.isArray(c.parts)) {
      const text = c.parts
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
      if (text) return text;
    }
    if (typeof c.content === "string") return c.content;
  }
  return "";
}

/**
 * Wraps the AI SDK v5 chat stream in the same `data: {json}\n\n` SSE framing the
 * stock `chatRoute` emits (terminated by `data: [DONE]`).
 */
function sseResponse(stream: AsyncIterable<unknown>): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: text })}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-vercel-ai-ui-message-stream": "v1",
        "x-accel-buffering": "no",
      },
    }
  );
}

/**
 * Chat route for the companion agent.
 *
 * The stock `chatRoute` has no clean way for a client to supply a threadId,
 * but the companion's observational memory (scope: "thread") requires one and
 * refuses otherwise. This route accepts `{ messages, threadId?, resourceId? }`,
 * builds the memory RequestContext explicitly, and reuses the framework's own
 * `handleChatStream` so the SSE wire format stays identical to chatRoute's.
 * threadId/resourceId follow the same resolution rules as every other route
 * (see `resolveMemoryIds`: resourceId ?? userId ?? "anonymous"; thread falls
 * back to the resource id).
 */
export const chatRoutes = [
  {
    path: "/chat",
    method: "POST" as const,
    handler: async (c: any) => {
      const mastra: Mastra = c.get("mastra");
      const body = await c.req.json();
      const messages = body?.messages;
      if (!Array.isArray(messages)) {
        return json({ error: "Messages must be an array of { role, content } messages" }, 400);
      }

      const ids = resolveMemoryIds({
        workspaceId: resolveWorkspaceFromRequest(c, body),
        resourceId: body.resourceId,
        userId: body.userId,
        threadId: body.threadId,
      });
      const threadId = ids.threadId || ids.resourceId;
      const resourceId = ids.resourceId;
      const requestContext = new RequestContext();
      // The memory pipeline reads ids from two places: the reserved
      // `mastra__threadId`/`mastra__resourceId` keys (MessageHistory /
      // saveMessages / working memory) and the structured `MastraMemory`
      // context (observational memory). Both must be set or the async
      // observation persist fails with "Thread ID is required" after the
      // stream already finished.
      requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
      requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
      requestContext.set(MASTRA_MEMORY_KEY, { thread: { id: threadId }, resourceId });

      const stream = await handleChatStream({
        mastra,
        agentId: "companion",
        params: { messages, requestContext },
        sendStart: true,
        sendFinish: true,
        sendReasoning: false,
        sendSources: false,
      });

      return sseResponse(stream);
    },
  },
  {
    path: "/chat/approvals",
    method: "POST" as const,
    handler: async (c: any) => {
      const mastra: Mastra = c.get("mastra");
      const body = await c.req.json();
      const { runId, toolCallId } = body;
      if (typeof runId !== "string" || !runId || typeof toolCallId !== "string" || !toolCallId) {
        return json({ error: "runId and toolCallId are required" }, 400);
      }
      const approved = body.approved === true;
      const reason = typeof body.reason === "string" && body.reason.length > 0 ? body.reason : undefined;

      const ids = resolveMemoryIds({
        workspaceId: resolveWorkspaceFromRequest(c, body),
        resourceId: body.resourceId,
        threadId: body.threadId,
      });
      const threadId = ids.threadId || ids.resourceId;
      const resourceId = ids.resourceId;
      const requestContext = new RequestContext();
      requestContext.set(MASTRA_THREAD_ID_KEY, threadId);
      requestContext.set(MASTRA_RESOURCE_ID_KEY, resourceId);
      requestContext.set(MASTRA_MEMORY_KEY, { thread: { id: threadId }, resourceId });

      // Resumes the suspended run: `resumeData` mirrors what approveToolCall /
      // declineToolCall pass to the agent, and the continuation is streamed back
      // with the same SSE framing as /chat. (v5 does not forward toolCallId,
      // so the most recent suspended tool call of the run is resumed.)
      const stream = await handleChatStream({
        mastra,
        agentId: "companion",
        params: {
          messages: [],
          resumeData: approved ? { approved: true } : { approved: false, ...(reason ? { reason } : {}) },
          runId,
          requestContext,
        },
        sendStart: true,
        sendFinish: true,
        sendReasoning: false,
        sendSources: false,
      });
      return sseResponse(stream);
    },
  },
  {
    path: "/conversations",
    method: "GET" as const,
    handler: async (c: any) => {
      const resourceId = resolveMemoryIds({ workspaceId: resolveWorkspaceFromRequest(c), resourceId: c.req.query("resourceId") }).resourceId;
      const store = await memoryStore();
      const { threads } = await store.listThreads({
        filter: { resourceId },
        orderBy: { field: "updatedAt", direction: "DESC" },
        perPage: false,
      });
      return json({ conversations: threads.map(threadToJson) });
    },
  },
  {
    path: "/conversations",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { resourceId } = resolveMemoryIds({
        workspaceId: resolveWorkspaceFromRequest(c, body),
        resourceId: body.resourceId,
      });
      const id = typeof body.id === "string" && body.id.trim() ? body.id : globalThis.crypto.randomUUID();
      const store = await memoryStore();
      const now = new Date();
      const thread = {
        id,
        resourceId,
        title: typeof body.title === "string" ? body.title : "",
        metadata: {} as Record<string, unknown>,
        createdAt: now,
        updatedAt: now,
      };
      await store.saveThread({ thread });
      return json({ conversation: threadToJson(thread) }, 201);
    },
  },
  {
    path: "/conversations/:threadId",
    method: "PATCH" as const,
    handler: async (c: any) => {
      const { threadId } = c.req.param();
      const body = await c.req.json();
      const title = typeof body.title === "string" ? body.title : "";
      const thread = await getCompanionMemory().updateThread({ id: threadId, title });
      return json({ conversation: threadToJson(thread) });
    },
  },
  {
    path: "/conversations/:threadId",
    method: "DELETE" as const,
    handler: async (c: any) => {
      const { threadId } = c.req.param();
      // Memory-level delete also clears the observational memory record and
      // the thread's vector embeddings (the store only removes messages+thread).
      await getCompanionMemory().deleteThread(threadId);
      return new Response(null, { status: 204 });
    },
  },
  {
    path: "/conversations/:threadId/messages",
    method: "GET" as const,
    handler: async (c: any) => {
      const { threadId } = c.req.param();
      const store = await memoryStore();
      const { messages } = await store.listMessages({
        threadId,
        orderBy: { field: "createdAt", direction: "ASC" },
        perPage: false,
      });
      const out = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({
          id: m.id,
          role: m.role,
          content: extractMessageText(m),
          createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt ?? ""),
        }))
        .filter((m) => m.content.length > 0);
      return json({ messages: out });
    },
  },
];