import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, errorMessage } from "../../services/api";
import { connectLive } from "../analytics/liveConnection";
import { TbBrandWhatsapp, TbDotsVertical, TbSettings, TbSearch, TbSend, TbSparkles, TbChecks } from "react-icons/tb";
import AISettingsPanel from "./AISettingsPanel";
import "./whatsapp.css";
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
export default function WhatsAppPage() {
  const [selected, setSelected] = useState(null), [draft, setDraft] = useState(""), [error, setError] = useState(""), [sending, setSending] = useState(false), [older, setOlder] = useState([]), [loadingOlder, setLoadingOlder] = useState(false);
  const client = useQueryClient(), bottom = useRef(null);
  const [menu, setMenu] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [search, setSearch] = useState("");
  useEffect(() => {
    if (!menu) return;
    const close = event => { if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".wa-menu-wrap")) setMenu(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [menu]);
  const [liveStatus, setLiveStatus] = useState("connecting");
  useEffect(() => {
    const connection = connectLive({ ticketPath: "/whatsapp/live-ticket", livePath: "/whatsapp/live", staleAfter: 45000, onStatus: setLiveStatus,
      onMessage: event => {
        if (event.type === "unavailable") { setLiveStatus("reconnecting"); return; }
        if (["ready", "invalidate", "resync"].includes(event.type)) {
          if (event.type === "resync") setLiveStatus("connected");
          void client.invalidateQueries({ queryKey: ["whatsapp"] });
        }
      },
    });
    return connection.close;
  }, [client]);
  const chats = useQuery({ queryKey: ["whatsapp", "conversations"], queryFn: () => request("get", "/whatsapp/conversations"), refetchInterval: liveStatus === "connected" ? 60000 : 4000 });
  const messages = useQuery({ queryKey: ["whatsapp", selected], queryFn: () => request("get", `/whatsapp/conversations/${selected}/messages`), enabled: Boolean(selected), refetchInterval: liveStatus === "connected" ? 60000 : 3000 });
  const chat = chats.data?.conversations.find(c => c._id === selected);
  const productionTakeoverRequired = chats.data?.autoRepliesAvailable === false && chats.data?.aiEnabled;
  const visibleChats = chats.data?.conversations.filter(c => `${c.name || ""} ${c.phone} ${c.preview || ""}`.toLowerCase().includes(search.toLowerCase())) || [];
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages.data?.messages?.length, selected]);
  const choose = id => { if (sending) return; setSelected(id); setDraft(""); setError(""); setOlder([]); };
  const send = async event => {
    event.preventDefault(); if (sending || !draft.trim()) return;
    setSending(true); setError("");
    try {
      const result = await request("post", `/whatsapp/conversations/${selected}/messages`, { text: draft, requestId: crypto.randomUUID() });
      setDraft("");
      if (["failed", "unknown"].includes(result.status)) setError(result.error);
      await Promise.all([client.invalidateQueries({ queryKey: ["whatsapp", selected] }), client.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })]);
    } catch (err) { setError(errorMessage(err)); }
    finally { setSending(false); }
  };
  const loadOlder = async () => {
    setLoadingOlder(true);
    try { const first = older[0] || messages.data.messages[0]; const result = await request("get", `/whatsapp/conversations/${selected}/messages?before=${first._id}`); setOlder(current => [...result.messages, ...current]); }
    catch (err) { setError(errorMessage(err)); } finally { setLoadingOlder(false); }
  };
  const toggleAI = async () => {
    setError("");
    try { await request("patch", `/whatsapp/conversations/${selected}/ai`, { enabled: !chat.aiEnabled }); await client.invalidateQueries({ queryKey: ["whatsapp", "conversations"] }); }
    catch (err) { setError(errorMessage(err)); }
  };
  const allMessages = [...older, ...(messages.data?.messages || [])].filter((m, i, list) => list.findIndex(x => x._id === m._id) === i);
  return <section className="wa-page">
    <div className="wa-title"><div className="wa-title-brand"><TbBrandWhatsapp aria-hidden="true" /><div><h1>WhatsApp inbox</h1><p role="status">{liveStatus === "connected" ? "Live · Connected" : "Connecting live chat · Updates refresh automatically"}</p></div></div><div className="wa-menu-wrap"><button className="wa-icon" aria-label="Inbox menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(value => !value)}><TbDotsVertical /></button>{menu && <div role="menu" className="wa-menu"><button role="menuitem" onClick={() => { setSettingsOpen(true); setMenu(false); }}><TbSettings /> AI Settings</button></div>}</div></div>
    {(chats.isError || messages.isError) && <p role="alert" className="wa-error">{errorMessage(chats.error || messages.error)} · Retrying connection…</p>}
    {chats.data && !chats.data.configured && <p className="wa-notice">Backend Meta configuration is incomplete. Sending will be available when credentials are configured.</p>}
    <div className={`wa-inbox ${selected ? "wa-selected" : ""}`}>
      <aside className="wa-conversations" aria-label="Customer conversations"><header>Chats <span>{chats.data?.conversations.length || 0}</span></header><div className="wa-search"><TbSearch aria-hidden="true" /><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="wa-chat-filter">All chats <small>{chats.data?.aiEnabled ? "AI available" : "AI off"}</small></div>
        {chats.isPending && <p className="wa-empty">Loading conversations…</p>}
        {chats.data?.conversations.length === 0 && <p className="wa-empty">No conversations yet. Ask a customer to message your WhatsApp business number.</p>}
        {visibleChats.map(c => <button key={c._id} className={`wa-conversation ${selected === c._id ? "active" : ""}`} onClick={() => choose(c._id)} disabled={sending}><span className="wa-avatar">{(c.name || c.phone)[0]?.toUpperCase()}</span><span className="wa-contact"><strong>{c.name || `+${c.phone}`}</strong><span>{c.preview || `+${c.phone}`}</span></span><time>{time(c.lastMessageAt)}</time></button>)}
      </aside>
      <div className="wa-chat">{!chat ? <div className="wa-placeholder"><TbBrandWhatsapp aria-hidden="true" /><h2>Your WhatsApp conversations</h2><p>Select a conversation to read messages and reply.</p></div> : <>
        <header className="wa-chat-header"><button className="wa-back" onClick={() => choose(null)} aria-label="Back to conversations">←</button><span className="wa-avatar">{(chat.name || chat.phone)[0]?.toUpperCase()}</span><div className="wa-header-contact"><strong>{chat.name || chat.phone}</strong><small>+{chat.phone}</small></div><button className={`wa-ai-toggle ${chat.aiEnabled && chats.data?.aiEnabled ? "on" : ""}`} role="switch" aria-label="AI for this conversation" aria-checked={Boolean(chat.aiEnabled)} disabled={!chats.data?.aiEnabled || sending || chats.data?.autoRepliesAvailable === false} title={chats.data?.autoRepliesAvailable === false ? "AI controls are managed in the production inbox" : chats.data?.aiEnabled ? "Toggle AI for this conversation" : "Enable global AI in AI Settings first"} onClick={toggleAI}><TbSparkles /> AI {chat.aiEnabled && chats.data?.aiEnabled ? "on" : "off"}</button></header>
        <div className="wa-messages" role="log" aria-label="Messages">
          {messages.data?.hasMore && <button className="wa-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load earlier messages"}</button>}
          {messages.isPending && <p>Loading messages…</p>}
          {allMessages.map(m => <article key={m._id} className={`wa-message ${m.direction}`}><p>{m.text}</p><footer>{m.source === "ai" && <span className="wa-ai-label"><TbSparkles /> AI</span>}<time dateTime={m.timestamp} title={new Date(m.timestamp).toLocaleString()}>{time(m.timestamp)}</time><span className={`wa-message-status ${m.status}`}>{m.direction === "outbound" && ["delivered", "read"].includes(m.status) && <TbChecks aria-hidden="true" />}{m.direction === "outbound" ? m.status : "Received"}</span></footer>{m.error && <small className="wa-error">{m.error}</small>}</article>)}<div ref={bottom} />
        </div>
        {messages.data?.aiJob?.error && <p className="wa-notice" role="status">{messages.data.aiJob.error}</p>}
        {productionTakeoverRequired && <p className="wa-notice">AI is active in production. Use the production inbox to take over and send a manual reply.</p>}
        <div className="wa-window">{messages.data?.canReply ? `Reply window open until ${new Date(messages.data.windowExpiresAt).toLocaleString()}` : "Reply window closed. The customer must message you again before you can send text."}</div>
        {error && <p className="wa-error" role="alert">{error}</p>}
        <form className="wa-compose" onSubmit={send}><textarea aria-label="Message" placeholder="Type a message" maxLength={4096} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && draft.trim() && messages.data?.canReply && !sending && chats.data?.configured && !productionTakeoverRequired) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} disabled={sending || !messages.data?.canReply || !chats.data?.configured || productionTakeoverRequired} /><button aria-label={sending ? "Sending" : "Send message"} disabled={sending || !draft.trim() || !messages.data?.canReply || !chats.data?.configured || productionTakeoverRequired}><TbSend aria-hidden="true" /></button></form>
      </>}</div>
    </div>
    {settingsOpen && <AISettingsPanel conversationId={selected} onClose={() => setSettingsOpen(false)} />}
  </section>;
}
