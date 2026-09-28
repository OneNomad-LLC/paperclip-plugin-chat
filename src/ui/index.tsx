import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { useHostContext, useHostLocation, useHostNavigation, usePluginAction, usePluginData, MarkdownBlock } from "@paperclipai/plugin-sdk/ui";
import type { PluginPageProps, PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";
import { CSS } from "./styles";

// ---------- types (mirror the worker's shapes) ----------

interface AgentSummary { id: string; name: string; role: string; title: string | null; status: string; reportsTo: string | null }
interface ConversationSummary { id: string; title: string; agentId: string; agentName: string; createdAt: string; updatedAt: string; lastMessageAt: string | null; lastMessagePreview: string }
interface MessageDTO { id: string; role: "user" | "assistant"; text: string; createdAt: string; runId?: string; error?: string }
interface ConversationDTO { id: string; agentId: string; agentName: string; title: string; sessionId: string | null; createdAt: string; updatedAt: string; messages: MessageDTO[]; pending?: { runId: string; text: string; tools: string[]; startedAt: string } | null }

type ChatStreamEvent =
  | { type: "delta"; runId: string; text: string }
  | { type: "activity"; runId: string; tools: string[] }
  | { type: "done"; runId: string; text: string; messageId: string }
  | { type: "error"; runId: string; message: string; messageId: string };

// ---------- shared helpers ----------

function useStyles() {
  useEffect(() => {
    let el = document.getElementById("pcc-styles");
    if (!el) {
      el = document.createElement("style");
      el.id = "pcc-styles";
      document.head.appendChild(el);
    }
    if (el.textContent !== CSS) el.textContent = CSS;
  }, []);
}

function since(iso?: string | null) {
  if (!iso) return "";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return new Date(iso).toLocaleDateString();
}

function Icon({ d, sm }: { d: string; sm?: boolean }) {
  return <svg className={`pcc-i${sm ? " sm" : ""}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />;
}
const I = {
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  edit: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  up: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4M8 14h.01M16 14h.01"/>',
  run: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
};

// The same character Paperclip draws for agents, colored by the host's theme variables.
function AgentAvatar({ size = 28, name }: { size?: number; name?: string }) {
  const gradient = `pcc-pill-${useId().replace(/:/g, "")}`;
  return (
    <span className="pcc-avatar" style={{ width: size, height: size }} role="img" aria-label={name ? `${name} avatar` : "Agent avatar"}>
      <svg viewBox="0 0 100 93" fill="none" aria-hidden="true">
        <path d="M54.7022 14.3438C29.7981 14.3438 9.60938 34.5085 9.60938 59.3831V87.5272C9.60938 90.385 11.9261 92.7018 14.784 92.7018H94.6204C97.4782 92.7018 99.795 90.385 99.795 87.5272V59.3831C99.795 34.5085 79.6063 14.3438 54.7022 14.3438Z" fill={`url(#${gradient})`} />
        <rect x="76.1406" y="63.1328" width="8.87072" height="10.3492" rx="4.43536" fill="var(--pill-guy-eye, #060606)" />
        <rect x="28.8301" y="63.1328" width="8.87072" height="10.3492" rx="4.43536" fill="var(--pill-guy-eye, #060606)" />
        <path d="M22.5464 10.6842C15.1541 21.0252 20.3287 39.5225 0 45.762C17.2549 61.9384 64.3127 49.1324 74.6619 21.781C79.4668 33.6086 90.5552 41.0009 96.469 42.8447C112.362 5.51809 69.8569 -5.24463 62.8342 3.25648C48.7889 -3.39656 29.7044 0.670936 22.5464 10.6842Z" fill="var(--pill-guy-tuft, #2d200d)" />
        <defs>
          <linearGradient id={gradient} x1="54.7022" y1="14.3437" x2="54.7022" y2="107.486" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--pill-guy-alive-top, #3028aa)" />
            <stop offset="1" stopColor="var(--pill-guy-alive-bottom, #e5484d)" />
          </linearGradient>
        </defs>
      </svg>
    </span>
  );
}

function useActiveConversation() {
  const loc = useHostLocation();
  const nav = useHostNavigation();
  const ctx = useHostContext();
  const q = new URLSearchParams(loc.search);
  const activeId = q.get("c");
  const setActiveId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(loc.search);
      if (id) next.set("c", id);
      else next.delete("c");
      const qs = next.toString();
      nav.navigate(`/${ctx.companyPrefix}/chat${qs ? `?${qs}` : ""}`, { replace: false });
    },
    [loc.search, nav, ctx.companyPrefix],
  );
  return { activeId, setActiveId, companyId: ctx.companyId, companyPrefix: ctx.companyPrefix };
}

// ---------- slot: sidebar link ----------

export function ChatNavLink(_props: PluginSidebarProps) {
  useStyles();
  const nav = useHostNavigation();
  const ctx = useHostContext();
  const loc = useHostLocation();
  const on = loc.pathname.endsWith("/chat");
  const base = "flex items-center gap-2.5 mx-2 rounded-lg px-2 py-1.5 pointer-coarse:py-1 text-(length:--text-compact) font-medium transition-colors";
  const state = on ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground";
  return (
    <a {...nav.linkProps(`/${ctx.companyPrefix}/chat`)} className={`${base} ${state}`} aria-current={on ? "page" : undefined}>
      <span data-slot="sidebar-nav-icon" className="relative shrink-0">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: I.chat }} />
      </span>
      <span className="min-w-0 flex-1 truncate">Chat</span>
    </a>
  );
}

// ---------- slot: page ----------

export function ChatPage({ context }: PluginPageProps) {
  useStyles();
  const { activeId, setActiveId, companyId, companyPrefix } = useActiveConversation();
  const agentsQuery = usePluginData<{ agents: AgentSummary[]; defaultAgentId: string | null }>("agents", { companyId: companyId ?? "" });
  const conversationsQuery = usePluginData<ConversationSummary[]>("conversations", { companyId: companyId ?? "" });
  const createConversation = usePluginAction("create-conversation");
  const renameConversation = usePluginAction("rename-conversation");
  const deleteConversation = usePluginAction("delete-conversation");

  const [pickerOpen, setPickerOpen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(600);
  useLayoutEffect(() => {
    const measure = () => { const top = pageRef.current?.getBoundingClientRect().top ?? 0; setHeight(Math.max(420, window.innerHeight - top - 8)); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const agents = agentsQuery.data?.agents ?? [];
  const conversations = conversationsQuery.data ?? [];
  const active = conversations.find((c) => c.id === activeId) ?? null;

  async function handleCreate(agentId: string) {
    const convo = (await createConversation({ companyId, agentId })) as ConversationDTO;
    setPickerOpen(false);
    conversationsQuery.refresh();
    setActiveId(convo.id);
  }

  async function handleRename(conversationId: string, title: string) {
    await renameConversation({ companyId, conversationId, title });
    conversationsQuery.refresh();
  }

  async function handleDelete(conversationId: string) {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
    await deleteConversation({ companyId, conversationId });
    if (activeId === conversationId) setActiveId(null);
    conversationsQuery.refresh();
  }

  if (!context.companyId) {
    return (
      <div className="pcc pcc-page">
        <div className="pcc-center-empty">
          <p>Open Chat from inside a company to talk with an agent.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={pageRef} className="pcc pcc-page" style={{ height }}>
      <aside className="pcc-side">
        <header>
          <h1>Chat</h1>
          <button className="pcc-icon-btn" onClick={() => setPickerOpen((v) => !v)} aria-label="New chat">
            <Icon d={I.plus} />
          </button>
        </header>
        {pickerOpen && <AgentPicker agents={agents} defaultAgentId={agentsQuery.data?.defaultAgentId ?? null} onPick={handleCreate} onCancel={() => setPickerOpen(false)} />}
        <nav className="pcc-list">
          {conversations.length === 0 && !pickerOpen && (
            <p className="muted pcc-empty-list">No conversations yet. Start one with the agent you want to talk to.</p>
          )}
          {conversations.map((c) => (
            <ConversationRow
              key={c.id}
              convo={c}
              active={c.id === activeId}
              onSelect={() => setActiveId(c.id)}
              onRename={(title) => handleRename(c.id, title)}
              onDelete={() => handleDelete(c.id)}
            />
          ))}
        </nav>
      </aside>
      <main className="pcc-main">
        {active ? (
          <ChatThread
            key={active.id}
            companyId={companyId ?? ""}
            companyPrefix={companyPrefix}
            conversationId={active.id}
            agentId={active.agentId}
            agentName={active.agentName}
            agentTitle={agents.find((a) => a.id === active.agentId)?.title ?? null}
            onSent={() => conversationsQuery.refresh()}
          />
        ) : (
          <div className="pcc-center-empty" style={{ margin: "auto" }}>
            <AgentAvatar size={64} />
            <h3>Talk to an agent</h3>
            <p>Start a conversation without opening a task. Each message wakes the agent for a real run.</p>
            <button className="pcc-btn primary" onClick={() => setPickerOpen(true)}>
              New chat
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ---------- new chat picker ----------

function AgentPicker({
  agents,
  defaultAgentId,
  onPick,
  onCancel,
}: {
  agents: AgentSummary[];
  defaultAgentId: string | null;
  onPick: (agentId: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(defaultAgentId ?? agents[0]?.id ?? "");
  useEffect(() => {
    if (!selected && agents.length > 0) setSelected(defaultAgentId ?? agents[0].id);
  }, [agents, defaultAgentId, selected]);
  return (
    <div className="pcc-picker">
      <p className="pcc-picker-label">Chat with</p>
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
            {a.title && a.title !== a.name ? ` · ${a.title}` : ""}
          </option>
        ))}
      </select>
      <div className="pcc-picker-row">
        <button className="pcc-btn sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="pcc-btn primary sm" onClick={() => selected && onPick(selected)} disabled={!selected}>
          Start chat
        </button>
      </div>
    </div>
  );
}

// ---------- conversation list row ----------

function ConversationRow({
  convo,
  active,
  onSelect,
  onRename,
  onDelete,
}: {
  convo: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(convo.title);

  if (editing) {
    return (
      <div className="pcc-row editing">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onRename(value.trim() || convo.title);
              setEditing(false);
            } else if (e.key === "Escape") {
              setValue(convo.title);
              setEditing(false);
            }
          }}
          autoFocus
        />
        <button
          className="pcc-icon-btn"
          aria-label="Save"
          onClick={() => {
            onRename(value.trim() || convo.title);
            setEditing(false);
          }}
        >
          <Icon d={I.check} sm />
        </button>
      </div>
    );
  }

  return (
    <div className={`pcc-row${active ? " on" : ""}`}>
      <button className="pcc-row-main" onClick={onSelect}>
        <AgentAvatar size={26} name={convo.agentName} />
        <span className="pcc-row-text">
          <span className="pcc-row-top"><span className="pcc-row-title">{convo.title}</span><span className="pcc-row-time">{since(convo.lastMessageAt ?? convo.updatedAt)}</span></span>
          <span className="pcc-row-meta">{convo.agentName}{convo.lastMessagePreview && convo.lastMessagePreview !== convo.title ? `: ${convo.lastMessagePreview}` : ""}</span>
        </span>
      </button>
      <div className="pcc-row-actions">
        <button className="pcc-icon-btn" aria-label="Rename" onClick={() => setEditing(true)}>
          <Icon d={I.edit} sm />
        </button>
        <button className="pcc-icon-btn" aria-label="Delete" onClick={onDelete}>
          <Icon d={I.trash} sm />
        </button>
      </div>
    </div>
  );
}

// ---------- following an agent run ----------

interface RunView { text: string; tools: string[]; toolCount: number; status: string; summary: string | null }
const TERMINAL = new Set(["succeeded", "failed", "cancelled", "timed_out", "error"]);

function parseLog(content: string, carry: { rest: string; text: string; open: Map<string, number>; count: number }) {
  const lines = (carry.rest + content).split("\n");
  carry.rest = lines.pop() ?? "";
  for (const line of lines) {
    let entry: { chunk?: string };
    try { entry = JSON.parse(line); } catch { continue; }
    for (const part of (entry.chunk ?? "").split("\n")) {
      if (!part.startsWith("{")) continue;
      let e: { type?: string; text?: string; channel?: string; name?: string; status?: string };
      try { e = JSON.parse(part); } catch { continue; }
      if (e.type === "acpx.text_delta" && e.channel === "output" && e.text) carry.text += e.text;
      if (e.type === "acpx.tool_call" && e.name && e.status === "pending") { carry.open.set(e.name, (carry.open.get(e.name) ?? 0) + 1); carry.count++; }
      if (e.type === "acpx.tool_call" && e.name && e.status === "completed") {
        const n = (carry.open.get(e.name) ?? 1) - 1;
        n > 0 ? carry.open.set(e.name, n) : carry.open.delete(e.name);
      }
    }
  }
}

// Follows a run through Paperclip's own API with the viewer's session: status plus its log, read incrementally.
function useRun(runId: string | null) {
  const [view, setView] = useState<RunView | null>(null);
  useEffect(() => {
    if (!runId) { setView(null); return; }
    let live = true;
    let offset = 0;
    const carry = { rest: "", text: "", open: new Map<string, number>(), count: 0 };
    const tick = async () => {
      try {
        const log = await fetch(`/api/heartbeat-runs/${runId}/log?offset=${offset}&limitBytes=262144`, { credentials: "include" }).then((r) => r.json());
        if (typeof log.content === "string") parseLog(log.content, carry);
        const bytes = typeof log.content === "string" ? new TextEncoder().encode(log.content).length : 0;
        offset = typeof log.nextOffset === "number" ? log.nextOffset : offset + bytes;
        const run = await fetch(`/api/heartbeat-runs/${runId}`, { credentials: "include" }).then((r) => r.json());
        const summary = typeof run?.resultJson?.summary === "string" ? run.resultJson.summary : null;
        if (live) setView({ text: carry.text, tools: [...carry.open.keys()], toolCount: carry.count, status: String(run?.status ?? "running"), summary });
        if (live && !TERMINAL.has(String(run?.status))) timer = setTimeout(tick, 1500);
      } catch {
        if (live) timer = setTimeout(tick, 3000);
      }
    };
    let timer = setTimeout(tick, 300);
    return () => { live = false; clearTimeout(timer); };
  }, [runId]);
  return view;
}

// ---------- thread ----------

function initials(name: string) {
  return name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ChatThread({
  companyId,
  companyPrefix,
  conversationId,
  agentId,
  agentName,
  agentTitle,
  onSent,
}: {
  companyId: string;
  companyPrefix: string | null;
  conversationId: string;
  agentId: string;
  agentName: string;
  agentTitle?: string | null;
  onSent: () => void;
}) {
  const convoQuery = usePluginData<ConversationDTO>("conversation", { companyId, conversationId });
  const sendMessage = usePluginAction("send-message");
  const completeReply = usePluginAction("complete-reply");
  const [localSending, setLocalSending] = useState(false);
  const [optimistic, setOptimistic] = useState<MessageDTO | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const convo = convoQuery.data;
  const pending = convo?.pending ?? null;
  const run = useRun(pending?.runId || null);
  const sending = localSending || Boolean(pending);
  const messages = [...(convo?.messages ?? []), ...(optimistic && !convo?.messages.some((m) => m.role === "user" && m.text === optimistic.text && m.createdAt >= optimistic.createdAt.slice(0, 16)) ? [optimistic] : [])];

  // Waiting for the send to register, keep refreshing until the conversation shows the run.
  useEffect(() => {
    if (!sending || pending?.runId) return;
    const t = setInterval(() => convoQuery.refresh(), 1500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sending, pending?.runId]);

  // When the run ends, save the reply (the worker ignores duplicates) and show it.
  useEffect(() => {
    if (!pending?.runId || !run || !TERMINAL.has(run.status)) return;
    const text = run.text.trim() || run.summary || "";
    const error = run.status === "succeeded" ? undefined : `The run ${run.status.replace("_", " ")}.`;
    completeReply({ companyId, conversationId, runId: pending.runId, text, error }).finally(() => {
      setLocalSending(false);
      setOptimistic(null);
      convoQuery.refresh();
      onSent();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run?.status, pending?.runId]);

  useEffect(() => {
    if (convo && !convo.pending && localSending && convo.messages.at(-1)?.role === "assistant") { setLocalSending(false); setOptimistic(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, run?.text, run?.tools.length]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    requestAnimationFrame(autoGrow);
    setLocalSending(true);
    setOptimistic({ id: `local-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() });
    try {
      await sendMessage({ companyId, conversationId, prompt: text });
    } catch {
      setLocalSending(false);
    }
    convoQuery.refresh();
  }

  function onKeyDown(e: RKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const suggestions = ["How is the project going?", "What's blocked, and who needs to act?", "What should I review next?"];

  return (
    <div className="pcc-thread">
      <header className="pcc-head">
        <AgentAvatar size={32} name={agentName} />
        <div className="pcc-head-text">
          <b>{agentName}</b>
          <span>{agentTitle && agentTitle !== agentName ? agentTitle : "Agent"}</span>
        </div>
      </header>
      <div ref={scrollRef} className="pcc-scroll">
        <div className="pcc-column">
          {messages.length === 0 && !sending && (
            <div className="pcc-intro">
              <AgentAvatar size={64} name={agentName} />
              <h3>Chat with {agentName}</h3>
              <p>Ask a question, share an idea or hand over work. {agentName} can look at the company's tasks and act on what you ask.</p>
              <div className="pcc-suggest">
                {suggestions.map((q) => <button key={q} onClick={() => { setInput(q); requestAnimationFrame(() => textareaRef.current?.focus()); }}>{q}</button>)}
              </div>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} agentName={agentName} companyPrefix={companyPrefix} agentId={agentId} />
          ))}
          {sending && (
            <div className="pcc-msg assistant">
              <AgentAvatar name={agentName} />
              <div className="pcc-content">
                <div className="pcc-who"><b>{agentName}</b></div>
                {run?.text ? <div className="pcc-body"><MarkdownBlock content={run.text} /></div> : null}
                <div className="pcc-activity">
                  <span className="pcc-typing"><i /><i /><i /></span>
                  {run?.tools.length ? `Working: ${run.tools.join(", ")}` : run?.text ? "Writing" : "Thinking"}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="pcc-dock">
        <div className="pcc-composer">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); autoGrow(); }}
            onKeyDown={onKeyDown}
            placeholder={`Message ${agentName}…`}
            disabled={sending}
            rows={1}
          />
          <button className="pcc-send" onClick={send} disabled={!input.trim() || sending} aria-label="Send" title="Send (Enter)">
            <Icon d={I.up} />
          </button>
        </div>
        <div className="pcc-hint">
          <span><kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> for a new line</span>
          <span>Each message is a real agent run</span>
        </div>
      </div>
    </div>
  );
}

// ---------- messages ----------

function MessageBubble({ message, agentName, companyPrefix, agentId }: { message: MessageDTO; agentName: string; companyPrefix: string | null; agentId: string }) {
  const nav = useHostNavigation();
  const [copied, setCopied] = useState(false);
  if (message.role === "user") {
    return (
      <div className="pcc-msg user">
        <div className="pcc-bubble">{message.text}</div>
        <span className="pcc-time">{clock(message.createdAt)}</span>
      </div>
    );
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(message.text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };
  const runHref = companyPrefix ? `/${companyPrefix}/agents/${agentId}` : null;
  return (
    <div className="pcc-msg assistant">
      <AgentAvatar name={agentName} />
      <div className="pcc-content">
        <div className="pcc-who">
          <b>{agentName}</b>
          <span className="pcc-time">{clock(message.createdAt)}</span>
          <span className="pcc-grow" />
          <span className="pcc-tools">
            {message.text && <button className="pcc-icon-btn" onClick={copy} aria-label="Copy reply" title="Copy">{copied ? <Icon d={I.check} sm /> : <Icon d={I.copy} sm />}</button>}
            {message.runId && runHref && (
              <a className="pcc-icon-btn" href={nav.resolveHref(runHref)} onClick={(e) => { e.preventDefault(); nav.navigate(runHref); }} aria-label="View run" title="View run"><Icon d={I.run} sm /></a>
            )}
          </span>
        </div>
        {message.text ? <div className="pcc-body"><MarkdownBlock content={message.text} /></div> : null}
        {message.error && <p className="pcc-error">{message.error}</p>}
      </div>
    </div>
  );
}
