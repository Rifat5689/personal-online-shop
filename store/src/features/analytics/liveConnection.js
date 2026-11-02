import { request } from "../../services/api";
export function connectLive({ ticketPath, ticketBody, onMessage, onStatus, staleAfter = 0, livePath }) {
  let socket, retry, watchdog;
  let stopped = false;
  let attempt = 0;
  let ready = false;
  let lastMessage = Date.now();
  const send = value => { if (ready && socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(value)); };
  const reconnect = () => {
    if (stopped) return;
    ready = false; onStatus?.("reconnecting");
    clearTimeout(retry);
    retry = setTimeout(open, Math.min(30000, 1000 * 2 ** Math.min(attempt++, 5)) + Math.random() * 500);
  };
  const open = async () => {
    if (stopped) return;
    onStatus?.(attempt ? "reconnecting" : "connecting");
    try {
      const { ticket } = await request("post", ticketPath, ticketBody);
      if (stopped) return;
      const apiBase = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
      const url = new URL(livePath ? `${apiBase}${livePath}` : (import.meta.env.VITE_LIVE_URL || `${apiBase}/analytics/live`), window.location.origin);
      url.protocol = url.protocol === "https:" || url.protocol === "wss:" ? "wss:" : "ws:";
      socket = new WebSocket(url);
      lastMessage = Date.now();
      socket.onopen = () => socket.send(JSON.stringify({ type: "auth", ticket }));
      socket.onmessage = event => {
        try {
          const message = JSON.parse(event.data);
          lastMessage = Date.now();
          if (message.type === "ready") { ready = true; attempt = 0; onStatus?.("connected"); }
          onMessage?.(message, send);
        } catch { /* Ignore malformed updates. */ }
      };
      socket.onclose = reconnect;
      socket.onerror = () => socket.close();
    } catch { reconnect(); }
  };
  open();
  // A stalled handshake must retry even if the network never fires close.
  watchdog = setInterval(() => { if (socket && ((!ready && Date.now() - lastMessage > 15000) || (ready && staleAfter && Date.now() - lastMessage > staleAfter))) socket.close(); }, 5000);
  return { send, close: () => { stopped = true; clearTimeout(retry); clearInterval(watchdog); if (socket) { socket.onclose = null; socket.close(); } } };
}
