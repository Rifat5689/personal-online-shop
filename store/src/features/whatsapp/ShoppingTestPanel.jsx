import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { request, errorMessage } from "../../services/api";
export default function ShoppingTestPanel({ conversationId, testRecipients, onManualReply }) {
  const [session, setSession] = useState(null), [prompt, setPrompt] = useState(""), [image, setImage] = useState(null), [result, setResult] = useState(null), [busy, setBusy] = useState(false), [error, setError] = useState(""), [live, setLive] = useState(false);
  const client = useQueryClient();
  const pending = useQuery({ queryKey: ["whatsapp", "verifications"], queryFn: () => request("get", "/whatsapp/shopping/verifications"), refetchInterval: 5000 });
  const run = async () => {
    setBusy(true); setError("");
    try {
      let current = session;
      if (!current) { current = await request("post", "/whatsapp/shopping/sessions", { conversationId, ...(live ? { phone: testRecipients[0] } : {}) }); setSession(current); }
      let body = { prompt };
      if (image) { body = new FormData(); body.append("prompt", prompt); body.append("image", image); }
      const response = await request("post", `/whatsapp/shopping/sessions/${current.id}/preview`, body, { timeout: 65000 });
      setResult(response); await client.invalidateQueries({ queryKey: ["whatsapp", "verifications"] });
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };
  const stop = async () => {
    if (!session) return;
    try { await request("patch", `/whatsapp/shopping/sessions/${session.id}/ai`, { enabled: false }); setSession(null); setResult(null); } catch (err) { setError(errorMessage(err)); }
  };
  const resolve = async (id, status) => {
    try { await request("patch", `/whatsapp/shopping/verifications/${id}`, { status }); await client.invalidateQueries({ queryKey: ["whatsapp", "verifications"] }); } catch (err) { setError(errorMessage(err)); }
  };
  return <div className="wa-preview-section wa-shopping"><h3>Shopping assistant · Testing</h3><p>Search the existing catalog. Preview sends no WhatsApp messages.</p>
    <label><input type="checkbox" checked={live} disabled={Boolean(session) || busy || !testRecipients.length} onChange={event => setLive(event.target.checked)} /> Enable a test session for the approved personal number</label>
    <label htmlFor="wa-shopping-prompt">Customer message</label><textarea id="wa-shopping-prompt" rows={3} maxLength={2000} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="১০০০ টাকার মধ্যে ফেসওয়াশ দেখান" />
    <label htmlFor="wa-shopping-image">Product photo (JPEG, PNG, WebP · up to 5 MB)</label><input id="wa-shopping-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setImage(event.target.files?.[0] || null)} />
    <div className="wa-shopping-actions"><button type="button" onClick={run} disabled={busy || (!prompt.trim() && !image)}>{busy ? "Checking catalog…" : "Test shopping reply"}</button>{session && <button type="button" onClick={stop}>Stop test / Human takeover</button>}</div>
    {result && <div className="wa-preview" role="status"><p>{result.reply}</p>{result.format === "images" && result.products.map((product, index) => <div className="wa-product-preview" key={product.id}>{product.images[0] && <img src={product.images[0]} alt={product.name} loading="lazy" />}<div><strong>{index + 1}. {product.name}</strong><p>{product.salePrice.toLocaleString("bn-BD")} টাকা</p>{product.url && <a href={product.url} target="_blank" rel="noreferrer">Product details</a>}</div></div>)}<small>Preview only · {result.searches} searches</small></div>}
    {error && <p className="wa-error" role="alert">{error}</p>}
    <h3>Owner verification {pending.data?.length ? `(${pending.data.length})` : ""}</h3>
    {pending.isError && <p className="wa-error">{errorMessage(pending.error)}</p>}
    {pending.data?.map(item => <div key={item._id} className="wa-verification"><strong>{item.productName}</strong><small>{item.customer} · {item.status}</small><div className="wa-shopping-actions"><button type="button" onClick={() => resolve(item._id, "available")}>Mark Available</button><button type="button" onClick={() => resolve(item._id, "unavailable")}>Mark Unavailable</button><button type="button" onClick={() => onManualReply?.(item.conversation)}>Reply Manually</button><button type="button" onClick={() => resolve(item._id, "resolved")}>Resolve Request</button></div><small>Reply manually in the inbox. This action never confirms an order or sends a message.</small></div>)}
  </div>;
}
