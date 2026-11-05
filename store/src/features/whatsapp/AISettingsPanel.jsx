import ShoppingTestPanel from "./ShoppingTestPanel";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TbArrowLeft, TbKey, TbSparkles } from "react-icons/tb";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, errorMessage } from "../../services/api";
export default function AISettingsPanel({ onClose, conversationId, onManualReply }) {
  const query = useQuery({ queryKey: ["whatsapp", "ai-settings"], queryFn: () => request("get", "/whatsapp/ai/settings") });
  const [form, setForm] = useState(null), [apiKey, setApiKey] = useState(""), [models, setModels] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState(""), [prompt, setPrompt] = useState("Hello! Could you tell me about your business?"), [preview, setPreview] = useState("");
  const client = useQueryClient(), panel = useRef(null), loaded = useRef(false);
  const busyRef = useRef(busy), closeRef = useRef(onClose); busyRef.current = busy; closeRef.current = onClose;
  useEffect(() => { if (query.data) { if (!loaded.current) { setForm(query.data); loaded.current = true; } else setForm(current => ({ ...current, enabled: query.data.enabled })); } }, [query.data]);
  useEffect(() => {
    const previous = document.activeElement;
    panel.current?.focus();
    const keydown = event => {
      if (event.key === "Escape" && !busyRef.current) closeRef.current();
      if (event.key === "Tab") {
        const nodes = [...panel.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')];
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("keydown", keydown); previous?.focus(); };
  }, []);
  const change = (name, value) => { setForm(current => ({ ...current, [name]: value })); setNotice(""); };
  const toggleGlobal = async enabled => {
    setBusy(true); setError(""); setNotice("");
    try { const result = await request("patch", "/whatsapp/ai/enabled", { enabled }); change("enabled", result.enabled); client.setQueryData(["whatsapp", "ai-settings"], result); await client.invalidateQueries({ queryKey: ["whatsapp", "conversations"] }); setNotice(enabled ? "Global AI enabled. Enable individual chats to allow automatic replies." : "Global AI is off. Pending replies will be cancelled before sending."); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const connect = async () => {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("post", "/whatsapp/ai/models", apiKey ? { apiKey } : {}, { timeout: 25000 });
      setModels(result.models);
      if (!result.models.includes(form.model)) change("model", result.models.includes("gemini-3.1-flash-lite") ? "gemini-3.1-flash-lite" : result.models[0] || "");
      setNotice(result.models.length ? "Connection verified for model access. Save settings to verify reply generation and keep your key and model." : "No supported Flash model is available for this key.");
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const save = async event => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await request("put", "/whatsapp/ai/settings", { enabled: form.enabled, instructions: form.instructions, model: form.model, tone: form.tone, ...(apiKey ? { apiKey } : {}) }, { timeout: 80000 });
      setForm(result); setModels(result.models || []); setApiKey("");
      client.setQueryData(["whatsapp", "ai-settings"], result);
      await client.invalidateQueries({ queryKey: ["whatsapp", "conversations"] });
      setNotice("Settings saved.");
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setError(""); setPreview("");
    try { const result = await request("post", "/whatsapp/ai/preview", { prompt, ...(conversationId ? { conversationId } : {}) }, { timeout: 65000 }); setPreview(result.reply); }
    catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  return createPortal(<div className="wa-settings-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="wa-settings" role="dialog" aria-modal="true" aria-labelledby="wa-settings-title" tabIndex={-1} ref={panel}>
      <header><button type="button" className="wa-icon" onClick={onClose} aria-label="Close AI Settings" disabled={busy}><TbArrowLeft /></button><h2 id="wa-settings-title">AI Settings</h2><TbSparkles aria-hidden="true" /></header>
      {query.isPending && <p className="wa-empty" role="status">Loading settings…</p>}
      {query.isError && <p className="wa-error" role="alert">{errorMessage(query.error)}</p>}
      {form && <form onSubmit={save} className="wa-settings-form">
        <div className="wa-setting-switch"><div><strong>AI auto reply</strong><p>{form.stagingSettings ? "Testing settings are separate. Live AI is restricted to the approved personal test recipient and an enabled test session." : form.autoRepliesAvailable === false ? "This inbox mirrors production. Live conversation controls remain in production." : "Only chats you explicitly enable receive automatic replies."}</p></div><input aria-label="Global AI Auto Reply" type="checkbox" role="switch" checked={form.enabled} onChange={event => toggleGlobal(event.target.checked)} disabled={busy || (form.autoRepliesAvailable === false && !form.stagingSettings)} /></div>
        <div className="wa-setting-section"><label htmlFor="wa-api-key"><TbKey aria-hidden="true" /> Gemini API key</label><input id="wa-api-key" type="password" autoComplete="new-password" spellCheck={false} value={apiKey} onChange={event => { setApiKey(event.target.value); setNotice(""); }} placeholder={form.keyConfigured ? "Key saved · enter a new key to replace it" : "Paste your Gemini API key"} disabled={busy} />
          <div className="wa-connection-row"><span className={form.connectionState === "connected" ? "connected" : ""}>{form.connectionState === "connected" ? "● Connected" : form.keyConfigured ? "● Key configured" : "○ Not connected"}</span><button type="button" onClick={connect} disabled={busy || (!apiKey && !form.keyConfigured)}>Check connection</button></div><small>Your saved key is never displayed. Paste a key, check the connection, then save.</small>
        </div>
        <div className="wa-setting-grid"><div><label htmlFor="wa-model">Gemini model</label><select id="wa-model" value={form.model} onChange={event => change("model", event.target.value)} disabled={busy}>{[...new Set([form.model, ...models])].filter(Boolean).map(model => <option key={model} value={model}>{model}</option>)}</select></div><div><label htmlFor="wa-tone">Reply tone</label><select id="wa-tone" value={form.tone} onChange={event => change("tone", event.target.value)} disabled={busy}>{["Friendly", "Professional", "Short"].map(tone => <option key={tone}>{tone}</option>)}</select></div></div>
        <div className="wa-setting-section"><label htmlFor="wa-personality">About Me / AI Personality &amp; Instructions</label><p className="wa-field-help">Write freely about yourself, your business, preferred language and how you want replies to sound. Include only facts the assistant should use.</p><textarea id="wa-personality" rows={12} maxLength={12000} value={form.instructions} onChange={event => change("instructions", event.target.value)} disabled={busy} placeholder="About me and my business…&#10;&#10;Preferred language and communication style…&#10;&#10;How to answer customers and when to ask for my help…" /><small>{form.instructions.length.toLocaleString()} / 12,000 characters · Sent as the system instruction with every AI reply.</small></div>
        <p className="wa-ai-disclosure">AI represents your communication style and must not claim to be human. Sending a manual reply turns AI off for that chat.</p>
        <button className="wa-primary" disabled={busy}>{busy ? "Working…" : "Save settings"}</button>
        {form.shoppingAvailable && <ShoppingTestPanel onManualReply={onManualReply} conversationId={conversationId} testRecipients={form.testRecipients || []} />}
        <div className="wa-preview-section"><h3>Try a response</h3><p>Uses your saved settings and recent chat context. No WhatsApp message is sent.</p><label htmlFor="wa-test-message">Test customer message</label><textarea id="wa-test-message" rows={3} maxLength={2000} value={prompt} onChange={event => setPrompt(event.target.value)} disabled={busy} /><button type="button" className="wa-secondary" onClick={test} disabled={busy || !form.keyConfigured || !prompt.trim()}>Test AI Response</button>{preview && <div className="wa-preview" role="status">{preview}</div>}</div>
        {error && <p className="wa-error" role="alert">{error}</p>}{notice && <p className="wa-save-notice" role="status">{notice}</p>}
      </form>}
    </section>
  </div>, document.body);
}
