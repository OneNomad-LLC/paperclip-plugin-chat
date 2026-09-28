import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
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
  // Follow-ups sent while the agent was replying. They go out together when the reply ends.
  queue?: { id: string; text: string; createdAt: string }[];
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
// Paperclip doesn't resume chat sessions between runs and cuts each message to an agent at 12,000
// characters, keeping the start. So the new message goes first, then as many recent turns as fit,
// and the full transcript is written to a file the agent can read.
const PROMPT_BUDGET = 11_000;
const PER_MESSAGE_CAP = 1_800;

function transcriptPath(companyId: string, conversationId: string) {
  return join(homedir(), ".paperclip", "plugin-data", "onenomad-chat", companyId, `${conversationId}.md`);
}

// Long text keeps its start and its end: decisions and questions tend to sit at either end.
function shorten(text: string, cap: number) {
  if (text.length <= cap) return text;
  const head = Math.floor(cap * 0.55);
  const tail = cap - head;
  return `${text.slice(0, head)}\n[… ${text.length - cap} characters left out here, the full text is in the transcript file …]\n${text.slice(-tail)}`;
}

function formatTurn(convo: Conversation, m: Message, cap = Infinity) {
  const who = m.role === "user" ? "Board" : `You (${convo.agentName})`;
  const body = shorten(m.text.trim(), cap);
  return `[${who}, ${m.createdAt.slice(0, 16).replace("T", " ")} UTC]\n${body}`;
}

async function writeTranscript(companyId: string, convo: Conversation) {
  const path = transcriptPath(companyId, convo.id);
  await mkdir(dirname(path), { recursive: true });
  const turns = convo.messages.filter((m) => m.text.trim()).map((m) => formatTurn(convo, m));
  await writeFile(path, `# Chat: ${convo.title}\n\nBetween the board and ${convo.agentName}, oldest first.\n\n${turns.join("\n\n")}\n`);
  return path;
}

function promptWithHistory(convo: Conversation, newCount: number, transcriptFile: string | null): string {
  const fresh = convo.messages.slice(-newCount).map((m) => m.text.trim());
  const heading = fresh.length > 1 ? "New messages from the board (sent one after another while you were replying; answer all of them):" : "New message from the board:";
  let newBlock = fresh.length > 1 ? fresh.map((t, i) => `${i + 1}. ${t}`).join("\n\n") : fresh[0] ?? "";
  newBlock = shorten(newBlock, 7_000);
  const intro = "This comes from Paperclip's Chat page. The board (the person who runs this company) is chatting with you directly, outside any task. Everything below is from that chat, written by the board and by you in earlier turns.";
  const fileNote = transcriptFile
    ? `The complete chat, word for word, is saved at ${transcriptFile} (written by Paperclip's Chat plugin). Read that file before you answer whenever your reply depends on something not shown here, such as older messages or ones marked as shortened.`
    : "";

  const earlier = convo.messages.slice(0, -newCount).filter((m) => m.text.trim());
  let used = intro.length + heading.length + newBlock.length + fileNote.length + 400;
  const recent: string[] = [];
  for (let k = earlier.length - 1; k >= 0; k--) {
    const turn = formatTurn(convo, earlier[k], PER_MESSAGE_CAP);
    if (used + turn.length + 2 > PROMPT_BUDGET) break;
    recent.unshift(turn);
    used += turn.length + 2;
  }
  const omitted = earlier.length - recent.length;
  return [
    intro,
    heading,
    newBlock,
    earlier.length ? `Recent chat history, oldest first${omitted ? ` (${omitted} older messages are only in the transcript file)` : ""}:` : "",
    recent.length ? `<conversation>\n${recent.join("\n\n")}\n</conversation>` : "",
    fileNote,
    "Reply to the board's new message, using the chat history as context.",
  ].filter(Boolean).join("\n\n");
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
    // Every change to a conversation goes through here: one at a time per conversation, always on fresh data.
    const locks = new Map<string, Promise<unknown>>();
    async function mutate<T>(companyId: string, conversationId: string, change: (convo: Conversation) => T): Promise<{ convo: Conversation; result: T } | null> {
      const key = `${companyId}:${conversationId}`;
      const run = (locks.get(key) ?? Promise.resolve()).then(async () => {
        const convo = await loadConversation(companyId, conversationId);
        if (!convo) return null;
        const result = change(convo);
        await saveConversation(companyId, convo);
        return { convo, result };
      });
      locks.set(key, run.catch(() => undefined));
      return run;
    }

    const placeholder = () => ({ runId: "", text: "", tools: [] as string[], startedAt: new Date().toISOString() });

    async function touchIndex(companyId: string, convo: Conversation, preview: string) {
      await upsertIndexEntry(companyId, {
        id: convo.id, title: convo.title, agentId: convo.agentId, agentName: convo.agentName,
        createdAt: convo.createdAt, updatedAt: convo.updatedAt, lastMessageAt: convo.updatedAt,
        lastMessagePreview: preview.trim().replace(/\s+/g, " ").slice(0, 140),
      });
    }

    // Saves the agent's reply once per run, whichever path gets there first, then sends anything queued.
    async function completeReply(companyId: string, conversationId: string, runId: string, text: string, error?: string) {
      const done = await mutate(companyId, conversationId, (convo) => {
        if (runId && convo.messages.some((m) => m.role === "assistant" && m.runId === runId)) return { saved: false, next: 0 };
        if (runId && convo.pending?.runId && convo.pending.runId !== runId) return { saved: false, next: 0 };
        const at = new Date().toISOString();
        convo.messages.push({ id: `a-${runId || Date.now()}`, role: "assistant", text, createdAt: at, runId: runId || undefined, error });
        convo.pending = null;
        convo.updatedAt = at;
        const queued = convo.queue ?? [];
        if (queued.length) {
          for (const q of queued) convo.messages.push({ id: q.id, role: "user", text: q.text, createdAt: q.createdAt });
          convo.queue = [];
          convo.pending = placeholder();
          convo.updatedAt = queued[queued.length - 1].createdAt;
        }
        return { saved: true, next: queued.length };
      });
      if (!done || !done.result.saved) return done?.convo ?? null;
      const last = done.convo.messages[done.convo.messages.length - 1];
      await touchIndex(companyId, done.convo, last.error ?? last.text);
      if (done.result.next) await startTurn(companyId, done.convo, done.result.next).catch((e) => ctx.logger.warn(`chat ${conversationId}: queued follow-up failed: ${e}`));
      return done.convo;
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
      const sent = await mutate(companyId, conversationId, (convo) => {
        const now = new Date().toISOString();
        if (convo.pending) {
          convo.queue = [...(convo.queue ?? []), { id: randomUUID(), text: prompt, createdAt: now }];
          return { queued: true };
        }
        if (convo.messages.length === 0) convo.title = titleFromPrompt(prompt);
        convo.messages.push({ id: randomUUID(), role: "user", text: prompt, createdAt: now });
        convo.updatedAt = now;
        convo.pending = placeholder();
        return { queued: false };
      });
      if (!sent) throw new Error("Conversation not found.");
      if (sent.result.queued) return { queued: true, conversationId };
      await touchIndex(companyId, sent.convo, prompt);
      return startTurn(companyId, sent.convo, 1);
    });

    ctx.actions.register("edit-queued", async (params) => {
      const { companyId, conversationId, queuedId, text } = params as { companyId?: string; conversationId?: string; queuedId?: string; text?: string };
      if (!companyId || !conversationId || !queuedId) return null;
      const trimmed = (text ?? "").trim();
      const edited = await mutate(companyId, conversationId, (convo) => {
        convo.queue = trimmed
          ? (convo.queue ?? []).map((q) => (q.id === queuedId ? { ...q, text: trimmed } : q))
          : (convo.queue ?? []).filter((q) => q.id !== queuedId);
        return convo.queue.some((q) => q.id === queuedId) ? "edited" : "removed";
      });
      return edited ? { ok: true, queued: edited.result } : null;
    });

    // Starts one agent run for the last `newCount` user messages, with the whole conversation as context.
    async function startTurn(companyId: string, convo: Conversation, newCount: number) {
      const conversationId = convo.id;
      const transcriptFile = await writeTranscript(companyId, convo).catch((e) => { ctx.logger.warn(`transcript write failed: ${e}`); return null; });
      const agentPrompt = promptWithHistory(convo, newCount, transcriptFile);
      const activeConvo: Conversation = convo;
      const channel = streamChannel(conversationId);
      try { ctx.streams.open(channel, companyId); } catch { /* the host may not have the stream bridge enabled */ }
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
          const partial = activeConvo.pending;
          if (!finalized && partial) void mutate(companyId, conversationId, (c) => {
            if (c.pending && (!c.pending.runId || c.pending.runId === partial.runId)) c.pending = { ...c.pending, runId: partial.runId, text: partial.text, tools: partial.tools };
          }).catch((e) => ctx.logger.warn(`chat save failed: ${e}`));
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
        await mutate(companyId, conversationId, (c) => {
          if (c.pending && !c.pending.runId) c.pending.runId = runId;
        });
        if (activeConvo.pending) activeConvo.pending.runId = runId;
      }

      async function ensureSession(): Promise<string> {
        if (activeConvo.sessionId) return activeConvo.sessionId;
        const session = await ctx.agents.sessions.create(activeConvo.agentId, companyId, { reason: "Chat plugin conversation" });
        activeConvo.sessionId = session.sessionId;
        await mutate(companyId, conversationId, (c) => { c.sessionId = session.sessionId; });
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
          await mutate(companyId, conversationId, (c) => { c.sessionId = null; });
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
    }
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
