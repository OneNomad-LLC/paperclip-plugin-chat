import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";
import type { AgentSessionEvent } from "@paperclipai/plugin-sdk";
import { randomUUID } from "node:crypto";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  runId?: string;
  error?: string;
}

interface Conversation {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string;
  title: string;
  sessionId: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  // The reply in progress. The page polls the conversation while this is set.
  pending?: { runId: string; text: string; tools: string[]; startedAt: string } | null;
}

interface ConversationSummary {
  id: string;
  title: string;
  agentId: string;
  agentName: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
}

type ChatStreamEvent =
  | { type: "delta"; runId: string; text: string }
  | { type: "activity"; runId: string; tools: string[] }
  | { type: "done"; runId: string; text: string; messageId: string }
  | { type: "error"; runId: string; message: string; messageId: string };

const NAMESPACE = "chat";
const TITLE_MAX = 60;

function indexKey(companyId: string) {
  return { scopeKind: "company" as const, scopeId: companyId, namespace: NAMESPACE, stateKey: "index" };
}
function conversationKey(companyId: string, id: string) {
  return { scopeKind: "company" as const, scopeId: companyId, namespace: NAMESPACE, stateKey: `conversation:${id}` };
}
// Paperclip doesn't resume chat sessions between runs, so every message carries the whole conversation.
const HISTORY_LIMIT = 120_000;

function promptWithHistory(convo: Conversation, newMessage: string): string {
  const earlier = convo.messages.slice(0, -1).filter((m) => m.text.trim());
  const lines = earlier.map((m) => {
    const who = m.role === "user" ? "Board" : `You (${convo.agentName})`;
    return `[${who}, ${m.createdAt.slice(0, 16).replace("T", " ")} UTC]\n${m.text.trim()}`;
  });
  let transcript = lines.join("\n\n");
  let trimmed = false;
  while (transcript.length > HISTORY_LIMIT && lines.length > 1) {
    lines.shift();
    trimmed = true;
    transcript = lines.join("\n\n");
  }
  const intro = "This is a direct chat with the board (the person who runs this company) in Paperclip's Chat page. It isn't attached to a task.";
  if (!lines.length) return `${intro}\n\nMessage from the board:\n${newMessage}`;
  return [
    intro,
    `The conversation so far, oldest first${trimmed ? " (the earliest messages were left out to save space)" : ""}:`,
    "<conversation>",
    transcript,
    "</conversation>",
    "New message from the board:",
    newMessage,
    "",
    "Reply to the new message, using the whole conversation above as context.",
  ].join("\n\n");
}

function titleFromPrompt(prompt: string): string {
  const flat = prompt.trim().replace(/\s+/g, " ");
  return flat.length > TITLE_MAX ? `${flat.slice(0, TITLE_MAX - 1)}…` : flat || "New chat";
}
function streamChannel(conversationId: string) {
  return `chat:${conversationId}`;
}

const plugin = definePlugin({
  async setup(ctx: PluginContext) {
    async function getIndex(companyId: string): Promise<ConversationSummary[]> {
      const raw = await ctx.state.get(indexKey(companyId));
      return Array.isArray(raw) ? (raw as ConversationSummary[]) : [];
    }
    async function saveIndex(companyId: string, list: ConversationSummary[]): Promise<void> {
      await ctx.state.set(indexKey(companyId), list);
    }
    async function upsertIndexEntry(companyId: string, entry: ConversationSummary): Promise<void> {
      const list = await getIndex(companyId);
      const i = list.findIndex((c) => c.id === entry.id);
      if (i >= 0) list[i] = entry;
      else list.unshift(entry);
      await saveIndex(companyId, list);
    }
    async function removeIndexEntry(companyId: string, id: string): Promise<void> {
      const list = await getIndex(companyId);
      await saveIndex(companyId, list.filter((c) => c.id !== id));
    }
    async function loadConversation(companyId: string, id: string): Promise<Conversation | null> {
      const raw = await ctx.state.get(conversationKey(companyId, id));
      return (raw as Conversation | null) ?? null;
    }
    // Saves the agent's reply once per run, whichever path gets there first (session events or the page).
    async function completeReply(companyId: string, conversationId: string, runId: string, text: string, error?: string) {
      const convo = await loadConversation(companyId, conversationId);
      if (!convo) return null;
      if (runId && convo.messages.some((m) => m.role === "assistant" && m.runId === runId)) return convo;
      const at = new Date().toISOString();
      convo.messages.push({ id: `a-${runId || Date.now()}`, role: "assistant", text, createdAt: at, runId: runId || undefined, error });
      convo.pending = null;
      convo.updatedAt = at;
      await saveConversation(companyId, convo);
      await upsertIndexEntry(companyId, {
        id: convo.id, title: convo.title, agentId: convo.agentId, agentName: convo.agentName,
        createdAt: convo.createdAt, updatedAt: at, lastMessageAt: at,
        lastMessagePreview: (error ?? text).trim().replace(/\s+/g, " ").slice(0, 140),
      });
      return convo;
    }

    async function saveConversation(companyId: string, convo: Conversation): Promise<void> {
      await ctx.state.set(conversationKey(companyId, convo.id), convo);
    }

    // ---------- data (reads) ----------

    ctx.data.register("agents", async (params) => {
      const companyId = params?.companyId as string | undefined;
      if (!companyId) return { agents: [], defaultAgentId: null };
      const agents = (await ctx.agents.list({ companyId })).filter((a) => a.status !== "terminated");
      const ceo = agents.find((a) => a.role === "ceo");
      const noReport = agents.find((a) => !a.reportsTo);
      const defaultAgentId = ceo?.id ?? noReport?.id ?? agents[0]?.id ?? null;
      return {
        agents: agents.map((a) => ({ id: a.id, name: a.name, role: a.role, title: a.title, status: a.status, reportsTo: a.reportsTo })),
        defaultAgentId,
      };
    });

    ctx.data.register("conversations", async (params) => {
      const companyId = params?.companyId as string | undefined;
      if (!companyId) return [];
      const list = await getIndex(companyId);
      return [...list].sort((a, b) => (b.lastMessageAt ?? b.updatedAt).localeCompare(a.lastMessageAt ?? a.updatedAt));
    });

    ctx.data.register("conversation", async (params) => {
      const companyId = params?.companyId as string | undefined;
      const conversationId = params?.conversationId as string | undefined;
      if (!companyId || !conversationId) return null;
      const convo = await loadConversation(companyId, conversationId);
      if (convo?.pending && Date.now() - new Date(convo.pending.startedAt).getTime() > 35 * 60 * 1000) {
        convo.messages.push({ id: `stale-${Date.now()}`, role: "assistant", text: convo.pending.text, createdAt: new Date().toISOString(), runId: convo.pending.runId || undefined, error: "The reply never finished. Check the agent's runs." } as Message);
        convo.pending = null;
        await saveConversation(companyId, convo);
      }
      return convo;
    });

    // ---------- actions (writes) ----------

    ctx.actions.register("create-conversation", async (params) => {
      const { companyId, agentId } = params as { companyId: string; agentId: string };
      const agent = await ctx.agents.get(agentId, companyId);
      if (!agent) throw new Error("Agent not found.");
      const now = new Date().toISOString();
      const convo: Conversation = {
        id: randomUUID(),
        companyId,
        agentId,
        agentName: agent.name,
        title: "New chat",
        sessionId: null,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      await saveConversation(companyId, convo);
      await upsertIndexEntry(companyId, {
        id: convo.id,
        title: convo.title,
        agentId,
        agentName: agent.name,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
        lastMessagePreview: "",
      });
      return convo;
    });

    ctx.actions.register("rename-conversation", async (params) => {
      const { companyId, conversationId, title } = params as { companyId: string; conversationId: string; title: string };
      const convo = await loadConversation(companyId, conversationId);
      if (!convo) throw new Error("Conversation not found.");
      const cleanTitle = title.trim().slice(0, TITLE_MAX) || convo.title;
      convo.title = cleanTitle;
      convo.updatedAt = new Date().toISOString();
      await saveConversation(companyId, convo);
      const list = await getIndex(companyId);
      const entry = list.find((c) => c.id === conversationId);
      if (entry) {
        entry.title = cleanTitle;
        entry.updatedAt = convo.updatedAt;
        await saveIndex(companyId, list);
      }
      return convo;
    });

    ctx.actions.register("complete-reply", async (params) => {
      const p = params as { companyId?: string; conversationId?: string; runId?: string; text?: string; error?: string };
      if (!p.companyId || !p.conversationId || !p.runId) return null;
      return completeReply(p.companyId, p.conversationId, p.runId, p.text ?? "", p.error || undefined);
    });

    ctx.actions.register("delete-conversation", async (params) => {
      const { companyId, conversationId } = params as { companyId: string; conversationId: string };
      await ctx.state.delete(conversationKey(companyId, conversationId));
      await removeIndexEntry(companyId, conversationId);
      return { ok: true };
    });

    ctx.actions.register("send-message", async (params) => {
      const { companyId, conversationId, prompt } = params as { companyId: string; conversationId: string; prompt: string };
      const convo = await loadConversation(companyId, conversationId);
      if (!convo) throw new Error("Conversation not found.");

      const isFirstMessage = convo.messages.length === 0;
      const now = new Date().toISOString();
      const userMessage: Message = { id: randomUUID(), role: "user", text: prompt, createdAt: now };
      convo.messages.push(userMessage);
      if (isFirstMessage) convo.title = titleFromPrompt(prompt);
      convo.updatedAt = now;
      await saveConversation(companyId, convo);
      const agentPrompt = promptWithHistory(convo, prompt);
      await upsertIndexEntry(companyId, {
        id: convo.id,
        title: convo.title,
        agentId: convo.agentId,
        agentName: convo.agentName,
        createdAt: convo.createdAt,
        updatedAt: convo.updatedAt,
        lastMessageAt: now,
        lastMessagePreview: prompt.trim().replace(/\s+/g, " ").slice(0, 140),
      });

      const activeConvo: Conversation = convo;
      const channel = streamChannel(conversationId);
      try { ctx.streams.open(channel, companyId); } catch { /* the host may not have the stream bridge enabled */ }
      activeConvo.pending = { runId: "", text: "", tools: [], startedAt: new Date().toISOString() };
      await saveConversation(companyId, activeConvo);
      ctx.logger.info(`chat ${conversationId}: sending to ${activeConvo.agentName}`);
      let lastSave = 0;
      let saveTimer: ReturnType<typeof setTimeout> | null = null;
      function savePending(runId: string) {
        activeConvo.pending = { runId, text: assistantText, tools: Array.from(pendingTools.keys()), startedAt: activeConvo.pending?.startedAt ?? new Date().toISOString() };
        const wait = Math.max(0, 1500 - (Date.now() - lastSave));
        if (saveTimer) return;
        saveTimer = setTimeout(() => {
          saveTimer = null;
          lastSave = Date.now();
          if (!finalized) void saveConversation(companyId, activeConvo).catch((e) => ctx.logger.warn(`chat save failed: ${e}`));
        }, wait);
      }

      const assistantMessageId = randomUUID();
      let assistantText = "";
      let carry = "";
      const pendingTools = new Map<string, number>();
      let finalized = false;

      function trackTool(name: string, status: string) {
        if (status === "pending") pendingTools.set(name, (pendingTools.get(name) ?? 0) + 1);
        else if (status === "completed") {
          const n = (pendingTools.get(name) ?? 1) - 1;
          if (n <= 0) pendingTools.delete(name);
          else pendingTools.set(name, n);
        }
      }

      function feedLines(chunk: string): string[] {
        const combined = carry + chunk;
        const lines = combined.split("\n");
        carry = lines.pop() ?? "";
        return lines;
      }

      function parseLine(line: string): Record<string, unknown> | null {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("[paperclip]")) return null;
        try {
          return JSON.parse(trimmed) as Record<string, unknown>;
        } catch {
          return null;
        }
      }

      function emit(event: ChatStreamEvent) {
        try { ctx.streams.emit(channel, event); } catch { /* no stream bridge: the page polls instead */ }
      }

      async function finalize(runId: string, text: string, errorMessage: string | undefined) {
        if (finalized) return;
        finalized = true;
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        await completeReply(companyId, activeConvo.id, runId, text, errorMessage);
        ctx.logger.info(`chat ${activeConvo.id}: reply saved (${text.length} chars${errorMessage ? `, error: ${errorMessage}` : ""})`);
        emit(
          errorMessage
            ? { type: "error", runId, message: errorMessage, messageId: assistantMessageId }
            : { type: "done", runId, text, messageId: assistantMessageId },
        );
        try { ctx.streams.close(channel); } catch { /* no stream bridge */ }
      }

      function onEvent(event: AgentSessionEvent) {
        if (event.eventType === "chunk") {
          for (const line of feedLines(event.message ?? "")) {
            const parsed = parseLine(line);
            if (!parsed) continue;
            if (parsed.type === "acpx.text_delta" && parsed.channel === "output" && typeof parsed.text === "string") {
              assistantText += parsed.text;
              emit({ type: "delta", runId: event.runId, text: assistantText });
              savePending(event.runId);
            } else if (parsed.type === "acpx.tool_call" && typeof parsed.name === "string" && typeof parsed.status === "string") {
              trackTool(parsed.name, parsed.status);
              emit({ type: "activity", runId: event.runId, tools: Array.from(pendingTools.keys()) });
              savePending(event.runId);
            }
          }
        } else if (event.eventType === "status") {
          ctx.logger.info(`chat ${activeConvo.id}: ${event.message ?? "status"}`);
        } else if (event.eventType === "done") {
          void finalize(event.runId, event.message ?? assistantText, undefined);
        } else if (event.eventType === "error") {
          void finalize(event.runId, assistantText, event.message ?? "The agent run failed.");
        }
      }

      async function recordRun(runId: string) {
        const fresh = await loadConversation(companyId, conversationId);
        if (!fresh?.pending) return;
        fresh.pending.runId = runId;
        activeConvo.pending = fresh.pending;
        await saveConversation(companyId, fresh);
      }

      async function ensureSession(): Promise<string> {
        if (activeConvo.sessionId) return activeConvo.sessionId;
        const session = await ctx.agents.sessions.create(activeConvo.agentId, companyId, { reason: "Chat plugin conversation" });
        activeConvo.sessionId = session.sessionId;
        await saveConversation(companyId, activeConvo);
        return session.sessionId;
      }

      try {
        let sessionId = await ensureSession();
        try {
          const result = await ctx.agents.sessions.sendMessage(sessionId, companyId, { prompt: agentPrompt, reason: "Chat plugin message", onEvent });
          await recordRun(result.runId);
          return { runId: result.runId, conversationId, assistantMessageId };
        } catch {
          activeConvo.sessionId = null;
          sessionId = await ensureSession();
          const result = await ctx.agents.sessions.sendMessage(sessionId, companyId, { prompt: agentPrompt, reason: "Chat plugin message", onEvent });
          await recordRun(result.runId);
          return { runId: result.runId, conversationId, assistantMessageId };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not reach the agent.";
        await finalize("none", assistantText, message);
        throw err;
      }
    });
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
