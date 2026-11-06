import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TbTrash, TbX } from "react-icons/tb";
import { request, errorMessage } from "../../services/api";
export default function DeleteChatDialog({ chat, onClose, onDeleted }) {
  const [scope, setScope] = useState(null), [username, setUsername] = useState(""), [password, setPassword] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const panel = useRef(null), busyRef = useRef(false); busyRef.current = busy;
  useEffect(() => {
    let active = true;
    request("get", `/whatsapp/conversations/${chat._id}/delete-scope`).then(data => { if (active) setScope(data); }).catch(err => { if (active) setError(errorMessage(err)); });
    const previous = document.activeElement; panel.current?.focus();
    const key = event => {
      if (event.key === "Escape" && !busyRef.current) onClose();
      if (event.key === "Tab") { const nodes = [...panel.current.querySelectorAll("button:not(:disabled),input:not(:disabled)")]; const first = nodes[0], last = nodes.at(-1); if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first?.focus(); } }
    };
    document.addEventListener("keydown", key);
    return () => { active = false; document.removeEventListener("keydown", key); previous?.focus(); };
  }, [chat._id]);
  const remove = async event => {
    event.preventDefault(); if (!scope || busy) return; setBusy(true); setError("");
    try { await request("delete", `/whatsapp/conversations/${chat._id}`, { confirmed: true, ...(scope.requiresProductionAuthentication ? { productionUsername: username, productionPassword: password } : {}) }, { timeout: 30000 }); setPassword(""); onDeleted(); }
    catch (err) { setPassword(""); if (err.response?.status === 404) onDeleted(); else setError(errorMessage(err)); }
    finally { setBusy(false); }
  };
  return createPortal(<div className="wa-delete-overlay"><section className="wa-delete-dialog" role="dialog" aria-modal="true" aria-labelledby="wa-delete-title" tabIndex={-1} ref={panel}><header><span className="wa-delete-symbol"><TbTrash /></span><button type="button" className="wa-icon" aria-label="Cancel deletion" onClick={onClose} disabled={busy}><TbX /></button></header><h2 id="wa-delete-title">Delete chat</h2><p>Delete the conversation with <strong>{chat.name || chat.phone}</strong> and its message history?</p>{!scope && !error && <p role="status">Checking where this chat is stored…</p>}{scope && <><p className="wa-delete-warning">{scope.scope === "production-and-staging" ? "This permanently removes this chat from BOTH production and staging. This cannot be undone." : "This permanently removes this staging chat. This cannot be undone."}</p><p className="wa-delete-help">Messages already delivered stay on the customer's WhatsApp. A new incoming message can start a new chat.</p></>}<form onSubmit={remove}>{scope?.requiresProductionAuthentication && <div className="wa-delete-auth"><p>Confirm with the production owner's login. The staging demo login cannot authorize production deletion.</p><label htmlFor="wa-delete-owner">Production username</label><input id="wa-delete-owner" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" maxLength={100} required disabled={busy} /><label htmlFor="wa-delete-password">Production password</label><input id="wa-delete-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" maxLength={128} required disabled={busy} /></div>}{error && <p role="alert" className="wa-error">{error}</p>}<footer><button type="button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="wa-delete-confirm" disabled={!scope || busy || (scope.requiresProductionAuthentication && (!username || !password))}>{busy ? "Deleting…" : scope?.scope === "production-and-staging" ? "Delete everywhere" : "Delete chat"}</button></footer></form></section></div>, document.body);
}
