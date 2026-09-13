import { handleChatStream } from "@mastra/ai-sdk";
import type { Mastra } from "@mastra/core/mastra";
import type { Agent } from "@mastra/core/agent";
import {
  RequestContext,
  MASTRA_RESOURCE_ID_KEY,
  MASTRA_THREAD_ID_KEY,
} from "@mastra/core/request-context";
import type { MastraDBMessage } from "@mastra/core/agent";
import { resolveMemoryIds } from "../agents/companion/memory-context";
import { companionStorage, getCompanionMemory } from "../agents/companion/memory";
import { resolveWorkspaceFromRequest } from "../workspaces/resolve";
import { getWorkspaceRuntime } from "../workspaces/runtime";
import { resolveProjectFromRequest } from "../projects/resolve";
import { getProjectCompanion } from "../projects/runtime";
import { appendRunEvents, deleteRunEventsForThread, listRunEvents, toRunEventInput } from "../activity/run-events-store";

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

/**
 * Pick the companion bound to the request scope. Global sessions (no project
 * id) run the workspace's own companion, rooted on the workspace folder so it
 * may touch any project of the workspace; project sessions run a companion
 * confined to the project's root. Throws when the project does not exist or
 * belongs to another workspace.
 */
async function resolveCompanion(
  c: any,
  body: Record<string, unknown>,
): Promise<{ agent: Agent; workspaceId: string; projectId: string | null }> {
  const workspaceId = resolveWorkspaceFromRequest(c, body);
  const projectId = resolveProjectFromRequest(c, body);

  if (projectId) {
    return { agent: await getProjectCompanion(workspaceId, projectId), workspaceId, projectId };
  }
  return { agent: (await getWorkspaceRuntime(workspaceId)).companion, workspaceId, projectId: null };
}

/**
 * Stream the scoped companion with the stock chat machinery. The companion for
 * a (workspace, project) scope is built lazily and never registered on the
 * Mastra instance, so hand `handleChatStream` the exact agent we resolved:
 * `getAgentById` is the only instance surface its v5 path uses.
 */
function scopedChatStream(agent: Agent, params: Record<string, unknown>): Promise<AsyncIterable<unknown>> {
  return handleChatStream({
    mastra: { getAgentById: () => agent } as unknown as Mastra,
    agentId: "companion",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: params as any,
    sendStart: true,
    sendFinish: true,
    sendReasoning: true,
    sendSources: false,
  });
}

/** Serialize a stored thread into the shape the UI consumes. */
function threadToJson(thread: {
  id: string;
  title?: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
  createdAt?: Date | null;
  updatedAt?: Date | null;
}) {
  const projectId = typeof thread.metadata?.projectId === "string" ? thread.metadata.projectId : null;
  return {
    id: thread.id,
    title: thread.title ?? "",
    resourceId: thread.resourceId ?? null,
    projectId,
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
 * Collects the raw movement chunks of one streamed turn and persists them in
 * bounded batches (flushed every 32 events, then once at stream end) so the
 * Activity panel can replay the turn without blocking the SSE loop.
 */
function runEventCollector(meta: {
  threadId: string;
  resourceId?: string | null;
  workspaceId?: string | null;
  projectId?: string | null;
}) {
  const buffer: unknown[] = [];
  const flushNow = () => {
    if (buffer.length === 0) return;
    const events = buffer
      .splice(0, buffer.length)
      .map((chunk) => toRunEventInput(chunk, meta))
      .filter((e): e is NonNullable<typeof e> => e !== null);
    if (events.length > 0) void appendRunEvents(events);
  };
  return {
    onChunk: (chunk: unknown) => {
      if (!chunk || typeof chunk !== "object") return;
      const type = (chunk as { type?: unknown }).type;
      if (typeof type !== "string" || type === "data-om-status") return;
      buffer.push(chunk);
      if (buffer.length >= 32) flushNow();
    },
    onEnd: flushNow,
  };
}

/**
 * Wraps the AI SDK v5 chat stream in the same `data: {json}\n\n` SSE framing the
 * stock `chatRoute` emits (terminated by `data: [DONE]`).
 */
function sseResponse(
  stream: AsyncIterable<unknown>,
  hooks?: { onChunk?: (chunk: unknown) => void; onEnd?: () => void },
): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            hooks?.onChunk?.(chunk);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }
        } catch (error) {
          const text = error instanceof Error ? error.message : String(error);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", errorText: text })}\n\n`));
        }
        hooks?.onEnd?.();
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
 * refuses otherwise. This route accepts `{ messages, threadId?, resourceId?,
 * projectId? }`, builds the memory RequestContext explicitly, and reuses the
 * framework's own `handleChatStream` so the SSE wire format stays identical
 * to chatRoute's. The agent follows the request scope (`resolveCompanion`):
 * no projectId -> the workspace's companion (workspace-wide files), projectId
 * -> a companion confined to the project's root. threadId/resourceId follow
 * the same resolution rules as every other route (see `resolveMemoryIds`:
 * resourceId ?? userId ?? "anonymous"; thread falls back to the resource id).
 */
export const chatRoutes = [
  {
    path: "/chat",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const messages = body?.messages;
      if (!Array.isArray(messages)) {
        return json({ error: "Messages must be an array of { role, content } messages" }, 400);
      }

      let agent: Agent;
      let workspaceId = "";
      let projectId: string | null = null;
      try {
        ({ agent, workspaceId, projectId } = await resolveCompanion(c, body));
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Project scope not found." },
          404,
        );
      }

      const ids = resolveMemoryIds({
        workspaceId,
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

      const stream = await scopedChatStream(agent, { messages, requestContext });
      const collector = runEventCollector({ threadId, resourceId, workspaceId, projectId });

      return sseResponse(stream, collector);
    },
  },
  {
    path: "/chat/approvals",
    method: "POST" as const,
    handler: async (c: any) => {
      const body = await c.req.json();
      const { runId, toolCallId } = body;
      if (typeof runId !== "string" || !runId || typeof toolCallId !== "string" || !toolCallId) {
        return json({ error: "runId and toolCallId are required" }, 400);
      }
      const approved = body.approved === true;
      const reason = typeof body.reason === "string" && body.reason.length > 0 ? body.reason : undefined;

      let agent: Agent;
      let workspaceId = "";
      let projectId: string | null = null;
      try {
        ({ agent, workspaceId, projectId } = await resolveCompanion(c, body));
      } catch (error) {
        return json(
          { error: error instanceof Error ? error.message : "Project scope not found." },
          404,
        );
      }

      const ids = resolveMemoryIds({
        workspaceId,
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
      const stream = await scopedChatStream(agent, {
        messages: [],
        resumeData: approved ? { approved: true } : { approved: false, ...(reason ? { reason } : {}) },
        runId,
        requestContext,
      });
      const collector = runEventCollector({ threadId, resourceId, workspaceId, projectId });
      return sseResponse(stream, collector);
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
      // A conversation belongs either to its project (local session) or to the
      // workspace at large (global session). Persisted on the thread metadata.
      const projectId = typeof body.projectId === "string" && body.projectId.trim() ? body.projectId : null;
      const store = await memoryStore();
      const now = new Date();
      const thread = {
        id,
        resourceId,
        title: typeof body.title === "string" ? body.title : "",
        metadata: projectId ? { projectId } : ({} as Record<string, unknown>),
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
      void deleteRunEventsForThread(threadId);
      return new Response(null, { status: 204 });
    },
  },
  {
    path: "/conversations/:threadId/activity",
    method: "GET" as const,
    handler: async (c: any) => {
      const { threadId } = c.req.param();
      const events = await listRunEvents(threadId);
      return json({ events });
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