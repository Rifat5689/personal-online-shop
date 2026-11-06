import DeleteChatDialog from "./DeleteChatDialog";
import React, { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, errorMessage } from "../../services/api";
import { connectLive } from "../analytics/liveConnection";
import { TbBrandWhatsapp, TbDotsVertical, TbSettings, TbSearch, TbSend, TbSparkles, TbChecks, TbPlus, TbPhoto, TbVideo, TbX, TbMoodSmile, TbMessageCircle, TbLock, TbTrash } from "react-icons/tb";
import MessageImage from "./MessageImage";
import AISettingsPanel from "./AISettingsPanel";
import "./whatsapp.css";
const time = value => value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
export default function WhatsAppPage() {
  const [selected, setSelected] = useState(null), [draft, setDraft] = useState(""), [error, setError] = useState(""), [sending, setSending] = useState(false), [older, setOlder] = useState([]), [loadingOlder, setLoadingOlder] = useState(false);
  const client = useQueryClient(), bottom = useRef(null), fileInput = useRef(null), pendingRequest = useRef(null);
  const [attachment, setAttachment] = useState(null), [attachmentUrl, setAttachmentUrl] = useState(""), [attachMenu, setAttachMenu] = useState(false), [emojis, setEmojis] = useState(false);
  useEffect(() => { if (!attachment) { setAttachmentUrl(""); return; } const url = URL.createObjectURL(attachment); setAttachmentUrl(url); return () => URL.revokeObjectURL(url); }, [attachment]);
  const [menu, setMenu] = useState(false), [settingsOpen, setSettingsOpen] = useState(false), [search, setSearch] = useState("");
  useEffect(() => {
    if (!menu) return;
    const close = event => { if (event.type === "keydown" ? event.key === "Escape" : !event.target.closest?.(".wa-menu-wrap")) setMenu(false); };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, [menu]);
  const [chatMenu, setChatMenu] = useState(false), [deleteOpen, setDeleteOpen] = useState(false);
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
  const productionTakeoverRequired = chats.data?.autoRepliesAvailable === false && (chat?.stagingTest ? (chat.productionAIEnabled ?? chats.data?.productionAIEnabled) : (chats.data?.productionAIEnabled ?? chats.data?.aiEnabled));
  const mediaBlocked = Boolean(chat?.aiEnabled && chats.data?.aiEnabled);
  const visibleChats = chats.data?.conversations.filter(c => `${c.name || ""} ${c.phone} ${c.preview || ""}`.toLowerCase().includes(search.toLowerCase())) || [];
  useEffect(() => { bottom.current?.scrollIntoView({ block: "nearest" }); }, [messages.data?.messages?.length, selected]);
  const choose = id => { if (sending) return; setSelected(id); setDraft(""); setError(""); setOlder([]); setAttachment(null); setAttachMenu(false); setChatMenu(false); pendingRequest.current = null; };
  const send = async event => {
    event.preventDefault(); if (sending || (!draft.trim() && !attachment)) return;
    if (attachment && mediaBlocked) { setError("Turn off AI for this chat before sending attachments."); return; }
    setSending(true); setError("");
    try {
      pendingRequest.current ||= crypto.randomUUID();
      let result;
      if (attachment) {
        const body = new FormData(); body.append("file", attachment); body.append("caption", draft); body.append("requestId", pendingRequest.current);
        result = await request("post", `/whatsapp/conversations/${selected}/media`, body, { timeout: 65000 });
      } else result = await request("post", `/whatsapp/conversations/${selected}/messages`, { text: draft, requestId: pendingRequest.current });
      setDraft(""); setAttachment(null); pendingRequest.current = null;
      if (["failed", "unknown"].includes(result.status)) setError(result.error);
      await Promise.all([client.invalidateQueries({ queryKey: ["whatsapp", selected] }), client.invalidateQueries({ queryKey: ["whatsapp", "conversations"] })]);
    } catch (err) { setError(errorMessage(err)); }
    finally { setSending(false); }
  };
  const pickAttachment = event => {
    const file = event.target.files?.[0]; event.target.value = ""; setAttachMenu(false); if (!file) return;
    if (!["image/jpeg", "image/png", "video/mp4"].includes(file.type) || file.size > (file.type === "video/mp4" ? 16 : 5) * 1024 * 1024) { setError("Choose JPEG/PNG up to 5 MB or MP4 up to 16 MB."); return; }
    setError(""); setAttachment(file); pendingRequest.current = null;
  };
  const openPicker = accept => { fileInput.current.accept = accept; fileInput.current.click(); setAttachMenu(false); };
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
  const takeOver = async () => {
    setSending(true); setError("");
    try { await request("post", `/whatsapp/conversations/${selected}/takeover`, { confirmed: true }); await client.invalidateQueries({ queryKey: ["whatsapp"] }); }
    catch (err) { setError(errorMessage(err)); } finally { setSending(false); }
  };
  const allMessages = [...older, ...(messages.data?.messages || [])].filter((m, i, list) => list.findIndex(x => x._id === m._id) === i);
  return <section className="wa-page">
    <div className="wa-title"><div className="wa-title-brand"><TbBrandWhatsapp aria-hidden="true" /><div><h1>WhatsApp inbox</h1><p role="status">{liveStatus === "connected" ? "Live · Connected" : "Connecting live chat · Updates refresh automatically"}</p></div></div><div className="wa-menu-wrap"><button className="wa-icon" aria-label="Inbox menu" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(value => !value)}><TbDotsVertical /></button>{menu && <div role="menu" className="wa-menu"><button role="menuitem" onClick={() => { setSettingsOpen(true); setMenu(false); }}><TbSettings /> AI Settings</button></div>}</div></div>
    {(chats.isError || messages.isError) && <p role="alert" className="wa-error">{errorMessage(chats.error || messages.error)} · Retrying connection…</p>}
    {chats.data && !chats.data.configured && <p className="wa-notice">Backend Meta configuration is incomplete. Sending will be available when credentials are configured.</p>}
    {chats.data?.pendingVerifications > 0 && <button type="button" className="wa-notice" onClick={() => setSettingsOpen(true)}>{chats.data.pendingVerifications} pending availability requests ? Review</button>}
    <div className="wa-workspace"><nav className="wa-rail" aria-label="WhatsApp workspace"><button className="wa-rail-active" aria-label="Chats" onClick={() => setSettingsOpen(false)}><TbMessageCircle /></button><button aria-label="AI configuration" onClick={() => setSettingsOpen(true)}><TbSparkles /></button><span className="wa-rail-spacer" /><button aria-label="Open settings" onClick={() => setSettingsOpen(true)}><TbSettings /></button><span className="wa-owner-avatar" title="Origins of Beauty">O</span></nav>
    <div className={`wa-inbox ${selected ? "wa-selected" : ""}`}>
      <aside className="wa-conversations" aria-label="Customer conversations"><header>Chats <span>{chats.data?.conversations.length || 0}</span></header><div className="wa-search"><TbSearch aria-hidden="true" /><input aria-label="Search conversations" placeholder="Search conversations" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="wa-chat-filter"><span className="wa-filter-active">All</span><span className="wa-ai-presence">{chats.data?.aiEnabled ? "AI available" : "AI off"}</span></div>
        {chats.isPending && <p className="wa-empty">Loading conversations…</p>}
        {chats.data?.conversations.length === 0 && <p className="wa-empty">No conversations yet. Ask a customer to message your WhatsApp business number.</p>}
        {visibleChats.map(c => <button key={c._id} className={`wa-conversation ${selected === c._id ? "active" : ""}`} onClick={() => choose(c._id)} disabled={sending}><span className="wa-avatar">{(c.name || c.phone)[0]?.toUpperCase()}</span><span className="wa-contact"><strong>{c.name || `+${c.phone}`}</strong><span>{c.preview || `+${c.phone}`}</span></span><time>{time(c.lastMessageAt)}</time></button>)}
      </aside>
      <div className="wa-chat">{!chat ? <div className="wa-placeholder"><div className="wa-welcome-icon"><TbBrandWhatsapp aria-hidden="true" /></div><h2>WhatsApp for your business</h2><p>Keep every customer conversation close.<br />Select a chat to reply, share products, and help customers.</p><small><TbLock /> Only your authorized team can access this inbox</small></div> : <>
        <header className="wa-chat-header"><button className="wa-back" onClick={() => choose(null)} aria-label="Back to conversations">←</button><span className="wa-avatar">{(chat.name || chat.phone)[0]?.toUpperCase()}</span><div className="wa-header-contact"><strong>{chat.name || chat.phone}</strong><small>+{chat.phone}</small></div><button className={`wa-ai-toggle ${chat.aiEnabled && chats.data?.aiEnabled ? "on" : ""}`} role="switch" aria-label="AI for this conversation" aria-checked={Boolean(chat.aiEnabled)} disabled={!chats.data?.aiEnabled || sending || (chats.data?.autoRepliesAvailable === false && !chat.stagingTest)} title={chats.data?.autoRepliesAvailable === false ? "AI controls are managed in the production inbox" : chats.data?.aiEnabled ? "Toggle AI for this conversation" : "Enable global AI in AI Settings first"} onClick={toggleAI}><TbSparkles /> AI {chat.aiEnabled && chats.data?.aiEnabled ? "on" : "off"}</button><div className="wa-menu-wrap"><button type="button" className="wa-icon" aria-label="Chat menu" aria-haspopup="menu" aria-expanded={chatMenu} onClick={() => setChatMenu(value => !value)}><TbDotsVertical /></button>{chatMenu && <div role="menu" className="wa-menu"><button role="menuitem" className="wa-delete-action" onClick={() => { setChatMenu(false); setDeleteOpen(true); }}><TbTrash /> Delete chat</button></div>}</div></header>
        <div className="wa-messages" role="log" aria-label="Messages">
          {messages.data?.hasMore && <button className="wa-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Loading…" : "Load earlier messages"}</button>}
          {messages.isPending && <p>Loading messages…</p>}
          {allMessages.map(m => <article key={m._id} className={`wa-message ${m.direction}`}>{["image", "video"].includes(m.type) && <MessageImage message={m} />}<p>{m.text}</p><footer>{m.source === "ai" && <span className="wa-ai-label"><TbSparkles /> AI</span>}<time dateTime={m.timestamp} title={new Date(m.timestamp).toLocaleString()}>{time(m.timestamp)}</time><span className={`wa-message-status ${m.status}`}>{m.direction === "outbound" && ["delivered", "read"].includes(m.status) && <TbChecks aria-hidden="true" />}{m.direction === "outbound" ? m.status : "Received"}</span></footer>{m.error && <small className="wa-error">{m.error}</small>}</article>)}<div ref={bottom} />
        </div>
        {chat.stagingTest && ["queued", "processing"].includes(messages.data?.aiJob?.status) && <p className="wa-notice" role="status">{messages.data.aiJob.status === "queued" ? "AI will reply 10 seconds after the latest customer message." : "AI is preparing a reply."}</p>}
        {messages.data?.aiJob?.error && <p className="wa-notice" role="status">{messages.data.aiJob.error}</p>}
        {productionTakeoverRequired && <div className="wa-notice">AI is active for this chat in production. {chat.stagingTest ? <button type="button" className="wa-secondary" onClick={takeOver} disabled={sending}>Take over chat</button> : <a href="https://originsofbeauty.web.app/secure/admin/whatsapp" target="_blank" rel="noreferrer">Open the production inbox to reply manually</a>}</div>}
        <div className="wa-window">{messages.data?.canReply ? `Reply window open until ${new Date(messages.data.windowExpiresAt).toLocaleString()}` : "Reply window closed. The customer must message you again before you can send text."}</div>
        {mediaBlocked && <p className="wa-media-hint">Turn off AI for this chat to attach photos or videos.</p>}
        {error && <p className="wa-error" role="alert">{error}</p>}
        {attachment && <div className="wa-attachment-preview" aria-label="Attachment preview"><header><span>{attachment.name}</span><button type="button" className="wa-icon" aria-label="Remove attachment" onClick={() => { setAttachment(null); pendingRequest.current = null; }} disabled={sending}><TbX /></button></header>{attachment.type === "video/mp4" ? <video src={attachmentUrl} controls preload="metadata" /> : <img src={attachmentUrl} alt="Photo ready to send" />}<small>{(attachment.size / 1024 / 1024).toFixed(2)} MB - Add an optional caption below</small></div>}
        {emojis && <div className="wa-emoji-picker">{["😊", "❤️", "👍", "🙏", "✨", "🌸"].map(emoji => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} onClick={() => { setDraft(value => (value + emoji).slice(0, attachment ? 1024 : 4096)); setEmojis(false); }}>{emoji}</button>)}</div>}
        <form className="wa-compose" onSubmit={send}><input ref={fileInput} type="file" hidden aria-label="Choose photo or video" onChange={pickAttachment} /><button type="button" className="wa-compose-tool" aria-label="Emoji" onClick={() => setEmojis(value => !value)} disabled={sending || !messages.data?.canReply}><TbMoodSmile /></button><div className="wa-attach-wrap"><button type="button" className="wa-compose-tool" aria-label="Attach media" aria-expanded={attachMenu} onClick={() => setAttachMenu(value => !value)} disabled={sending || mediaBlocked || !messages.data?.canReply || !chats.data?.configured || productionTakeoverRequired} title={mediaBlocked ? "Turn off AI for this chat to send photos or videos" : "Attach photos or videos"}><TbPlus /></button>{attachMenu && <div className="wa-attach-menu"><button type="button" onClick={() => openPicker("image/jpeg,image/png")}><TbPhoto /> Photos</button><button type="button" onClick={() => openPicker("video/mp4")}><TbVideo /> Videos</button></div>}</div><textarea aria-label="Message" placeholder={attachment ? "Add a caption..." : "Type a message"} maxLength={attachment ? 1024 : 4096} rows={1} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && (draft.trim() || attachment) && messages.data?.canReply && !sending && chats.data?.configured && !productionTakeoverRequired) { event.preventDefault(); event.currentTarget.form.requestSubmit(); } }} disabled={sending || !messages.data?.canReply || !chats.data?.configured || productionTakeoverRequired} /><button aria-label={sending ? "Sending" : "Send message"} disabled={sending || (attachment && mediaBlocked) || (!draft.trim() && !attachment) || !messages.data?.canReply || !chats.data?.configured || productionTakeoverRequired}><TbSend aria-hidden="true" /></button></form>
      </>}</div>
    </div>
    </div>
    {deleteOpen && chat && <DeleteChatDialog chat={chat} onClose={() => setDeleteOpen(false)} onDeleted={() => { setDeleteOpen(false); choose(null); void client.invalidateQueries({ queryKey: ["whatsapp"] }); }} />}
    {settingsOpen && <AISettingsPanel onManualReply={id => { if (id) choose(id); setSettingsOpen(false); }} conversationId={selected} onClose={() => setSettingsOpen(false)} />}
  </section>;
}
