import { useCallback, useEffect, useRef, useState, type KeyboardEvent as RKeyboardEvent } from "react";
import { useHostContext, useHostLocation, useHostNavigation, usePluginAction, usePluginData, usePluginStream, MarkdownBlock } from "@paperclipai/plugin-sdk/ui";
import type { PluginPageProps, PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";
import { CSS } from "./styles";

// ---------- types (mirror the worker's shapes) ----------

interface AgentSummary { id: string; name: string; role: string; title: string | null; status: string; reportsTo: string | null }
interface ConversationSummary { id: string; title: string; agentId: string; agentName: string; createdAt: string; updatedAt: string; lastMessageAt: string | null; lastMessagePreview: string }
interface MessageDTO { id: string; role: "user" | "assistant"; text: string; createdAt: string; runId?: string; error?: string }
interface ConversationDTO { id: string; agentId: string; agentName: string; title: string; sessionId: string | null; createdAt: string; updatedAt: string; messages: MessageDTO[] }

type ChatStreamEvent =
  | { type: "delta"; runId: string; text: string }
  | { type: "activity"; runId: string; tools: string[] }
  | { type: "done"; runId: string; text: string; messageId: string }
  | { type: "error"; runId: string; message: string; messageId: string };

// ---------- shared helpers ----------

function useStyles() {
  useEffect(() => {
    if (document.getElementById("pcc-styles")) return;
    const el = document.createElement("style");
    el.id = "pcc-styles";
    el.textContent = CSS;
    document.head.appendChild(el);
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
};

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
    <div className="pcc pcc-page">
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
            onSent={() => conversationsQuery.refresh()}
          />
        ) : (
          <div className="pcc-center-empty" style={{ margin: "auto" }}>
            <div className="ico">
              <Icon d={I.chat} />
            </div>
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
            {a.title ? ` — ${a.title}` : ""}
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
        <span className="pcc-row-title">{convo.title}</span>
        <span className="pcc-row-meta">
          {convo.agentName} · {since(convo.lastMessageAt ?? convo.updatedAt)}
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

// ---------- thread ----------

function ChatThread({
  companyId,
  companyPrefix,
  conversationId,
  agentId,
  agentName,
  onSent,
}: {
  companyId: string;
  companyPrefix: string | null;
  conversationId: string;
  agentId: string;
  agentName: string;
  onSent: () => void;
}) {
  const convoQuery = usePluginData<ConversationDTO>("conversation", { companyId, conversationId });
  const sendMessage = usePluginAction("send-message");
  const stream = usePluginStream<ChatStreamEvent>(`chat:${conversationId}`, { companyId });

  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [draft, setDraft] = useState<{ text: string; tools: string[] } | null>(null);
  const [sending, setSending] = useState(false);
  const [stoppedNotice, setStoppedNotice] = useState(false);
  const [input, setInput] = useState("");
  const processedRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (convoQuery.data) setMessages(convoQuery.data.messages);
  }, [convoQuery.data]);

  useEffect(() => {
    const events = stream.events;
    for (let i = processedRef.current; i < events.length; i++) {
      const evt = events[i];
      if (evt.type === "delta") {
        setDraft((d) => ({ text: evt.text, tools: d?.tools ?? [] }));
      } else if (evt.type === "activity") {
        setDraft((d) => ({ text: d?.text ?? "", tools: evt.tools }));
      } else if (evt.type === "done") {
        setMessages((m) => [...m, { id: evt.messageId, role: "assistant", text: evt.text, createdAt: new Date().toISOString(), runId: evt.runId }]);
        setDraft(null);
        setSending(false);
        onSent();
      } else if (evt.type === "error") {
        setMessages((m) => {
          const fallback = m[m.length - 1]?.role === "user" ? "" : "";
          return [...m, { id: evt.messageId, role: "assistant", text: fallback, createdAt: new Date().toISOString(), runId: evt.runId, error: evt.message }];
        });
        setDraft(null);
        setSending(false);
        onSent();
      }
    }
    processedRef.current = events.length;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.events]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, draft]);

  function autoGrow() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    requestAnimationFrame(autoGrow);
    setSending(true);
    setStoppedNotice(false);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: "user", text, createdAt: new Date().toISOString() }]);
    try {
      await sendMessage({ companyId, conversationId, prompt: text });
    } catch {
      setSending(false);
    }
  }

  function stop() {
    stream.close();
    setSending(false);
    setDraft(null);
    setStoppedNotice(true);
  }

  function onKeyDown(e: RKeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="pcc-thread">
      <header className="pcc-thread-head">
        <span className="pcc-agent">{agentName}</span>
      </header>
      <div className="pcc-scroll">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} companyPrefix={companyPrefix} agentId={agentId} />
        ))}
        {draft && (
          <div className="pcc-msg assistant">
            {draft.text ? (
              <div className="pcc-bubble">
                <MarkdownBlock content={draft.text} />
              </div>
            ) : null}
            {draft.tools.length > 0 && (
              <div className="pcc-activity">
                <span className="pcc-dot" />
                Working: {draft.tools.join(", ")}
              </div>
            )}
            {!draft.text && draft.tools.length === 0 && (
              <div className="pcc-activity">
                <span className="pcc-dot" />
                Thinking…
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="pcc-composer">
        {stoppedNotice && <p className="pcc-notice">Stopped streaming here. The agent may still finish the run in the background.</p>}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            autoGrow();
          }}
          onKeyDown={onKeyDown}
          placeholder={`Message ${agentName}… (Shift+Enter for a new line)`}
          disabled={sending}
          rows={1}
        />
        <div className="pcc-composer-row">
          <span className="muted">Each message starts a real agent run. The agent can act on what you ask, and runs have a cost.</span>
          {sending ? (
            <button className="pcc-btn" onClick={stop}>
              Stop
            </button>
          ) : (
            <button className="pcc-btn primary" onClick={send} disabled={!input.trim()}>
              Send
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- message bubble ----------

function MessageBubble({ message, companyPrefix, agentId }: { message: MessageDTO; companyPrefix: string | null; agentId: string }) {
  const nav = useHostNavigation();
  const isUser = message.role === "user";
  return (
    <div className={`pcc-msg ${isUser ? "user" : "assistant"}`}>
      <div className={`pcc-bubble${message.error ? " error" : ""}`}>
        {isUser ? message.text : <MarkdownBlock content={message.text || (message.error ? "" : "…")} />}
        {message.error && <p style={{ margin: "6px 0 0", color: "inherit" }}>Run failed: {message.error}</p>}
      </div>
      {!isUser && message.runId && (
        <div className="pcc-msg-meta">
          <a className="pcc-run-link" {...nav.linkProps(`/${companyPrefix}/agents/${agentId}`)}>
            Run {message.runId.slice(0, 8)}
          </a>
        </div>
      )}
    </div>
  );
}
