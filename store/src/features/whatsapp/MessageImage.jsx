import React, { useEffect, useState } from "react";
import api from "../../services/api";
export default function MessageImage({ message }) {
  const [url, setUrl] = useState(message.imageUrl || ""), [failed, setFailed] = useState(false);
  const [loadVideo, setLoadVideo] = useState(false);
  useEffect(() => {
    if (message.imageUrl || !message.mediaId || (message.type === "video" && !loadVideo)) return;
    let active = true, objectUrl;
    api.get(`/whatsapp/messages/${message._id}/${message.type === "video" ? "media" : "image"}`, { responseType: "blob", timeout: 30000 }).then(response => {
      if (active) { objectUrl = URL.createObjectURL(response.data); setUrl(objectUrl); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message._id, message.mediaId, message.imageUrl, message.type, loadVideo]);
  if (message.type === "video") return url && !failed ? <video className="wa-message-video" src={url} controls playsInline preload="metadata" onError={() => setFailed(true)} /> : failed ? <small>Video unavailable or expired</small> : <button type="button" className="wa-load-video" onClick={() => setLoadVideo(true)} disabled={loadVideo}>{loadVideo ? "Loading video…" : "▶ View video"}</button>;
  return url && !failed ? <img className="wa-message-image" src={url} alt="Product message" loading="lazy" onError={() => setFailed(true)} /> : <small>{failed ? "Image unavailable or expired" : "Image message"}</small>;
}
