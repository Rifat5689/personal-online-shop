import ApiError from "../../utils/ApiError.js";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX = 5 * 1024 * 1024;
export function validateImage(bytes, mime) {
  if (!TYPES.has(mime) || !bytes.length || bytes.length > MAX) throw new ApiError(400, "Use a JPEG, PNG or WebP image up to 5 MB");
  const valid = mime === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new ApiError(400, "Image contents do not match its type");
  return { inlineData: { mimeType: mime, data: bytes.toString("base64") } };
}
export async function downloadWhatsAppImage(mediaId, fetcher = fetch) {
  if (!/^\d{1,80}$/.test(mediaId || "")) throw new ApiError(400, "Invalid WhatsApp media reference");
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN, version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^v\d+\.0$/.test(version || "")) throw new ApiError(503, "Meta media is not configured");
  const options = { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(10000) };
  const metadata = await fetcher(`https://graph.facebook.com/${version}/${mediaId}`, options);
  if (!metadata.ok) throw new ApiError(400, "WhatsApp image could not be retrieved");
  const media = await metadata.json();
  let url; try { url = new URL(media.url); } catch { throw new ApiError(400, "Invalid Meta media URL"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !["facebook.com", "fbcdn.net", "fbsbx.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) || !TYPES.has(media.mime_type) || !Number.isFinite(Number(media.file_size)) || media.file_size > MAX) throw new ApiError(400, "Unsupported Meta image");
  const response = await fetcher(url.href, options);
  if (!response.ok || Number(response.headers.get("content-length")) > MAX) throw new ApiError(400, "WhatsApp image download failed");
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > MAX) { await response.body.cancel().catch(() => {}); throw new ApiError(400, "Image exceeds 5 MB"); } chunks.push(chunk); }
  return validateImage(Buffer.concat(chunks), media.mime_type);
}
