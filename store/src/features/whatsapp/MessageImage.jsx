import React, { useEffect, useState } from "react";
import api from "../../services/api";
export default function MessageImage({ message }) {
  const [url, setUrl] = useState(message.imageUrl || ""), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (message.imageUrl || !message.mediaId) return;
    let active = true, objectUrl;
    api.get(`/whatsapp/messages/${message._id}/image`, { responseType: "blob" }).then(response => {
      if (active) { objectUrl = URL.createObjectURL(response.data); setUrl(objectUrl); }
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [message._id, message.mediaId, message.imageUrl]);
  return url && !failed ? <img className="wa-message-image" src={url} alt="Product message" loading="lazy" onError={() => setFailed(true)} /> : <small>{failed ? "Image unavailable or expired" : "Image message"}</small>;
}
