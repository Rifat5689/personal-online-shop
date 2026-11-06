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
export async function downloadCatalogImage(address, fetcher = fetch) {
  // These URLs come only from tenant-filtered products, never customer arguments.
  // Restrict anonymous fetches to existing storage providers; never forward Meta credentials.
  let url; try { url = new URL(address); } catch { return null; }
  const account = process.env.AZURE_STORAGE_ACCOUNT_NAME;
  const azureHost = account ? `${account}.blob.core.windows.net` : null;
  if (url.protocol !== "https:" || url.username || url.password || url.port || !(url.hostname === azureHost || url.hostname === "res.cloudinary.com")) return null;
  try {
    const response = await fetcher(url.href, { redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok || Number(response.headers.get("content-length")) > MAX) return null;
    const chunks = []; let size = 0;
    for await (const chunk of response.body) { size += chunk.length; if (size > MAX) return null; chunks.push(chunk); }
    return validateImage(Buffer.concat(chunks), response.headers.get("content-type")?.split(";")[0]);
  } catch { return null; }
}
export async function uploadCatalogImage(address, fetcher = fetch) {
  const image = await downloadCatalogImage(address, fetcher);
  if (!image) return null;
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN, phone = process.env.META_WHATSAPP_PHONE_NUMBER_ID, version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^\d+$/.test(phone || "") || !/^v\d+\.0$/.test(version || "")) return null;
  const form = new FormData();
  form.append("messaging_product", "whatsapp"); form.append("type", image.inlineData.mimeType);
  form.append("file", new Blob([Buffer.from(image.inlineData.data, "base64")], { type: image.inlineData.mimeType }), "product-image");
  try {
    const response = await fetcher(`https://graph.facebook.com/${version}/${phone}/media`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const result = await response.json(); return /^\d+$/.test(result.id || "") ? result.id : null;
  } catch { return null; }
}
export function validateAdminMedia(bytes, mime) {
  if (["image/jpeg", "image/png"].includes(mime)) { validateImage(bytes, mime); return "image"; }
  if (mime !== "video/mp4" || !bytes.length || bytes.length > 16 * 1024 * 1024 || bytes.toString("ascii", 4, 8) !== "ftyp" || !bytes.includes(Buffer.from("avc1"))) throw new ApiError(400, "Use JPEG/PNG up to 5 MB or an H.264 MP4 video up to 16 MB (AAC audio if present)");
  return "video";
}
export async function uploadWhatsAppMedia(bytes, mime, fetcher = fetch) {
  validateAdminMedia(bytes, mime);
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN, phone = process.env.META_WHATSAPP_PHONE_NUMBER_ID, version = process.env.META_GRAPH_API_VERSION;
  if (!token || !/^\d+$/.test(phone || "") || !/^v\d+\.0$/.test(version || "")) throw new ApiError(503, "WhatsApp media is not configured");
  const form = new FormData(); form.append("messaging_product", "whatsapp"); form.append("type", mime);
  form.append("file", new Blob([bytes], { type: mime }), mime === "video/mp4" ? "video.mp4" : mime === "image/png" ? "photo.png" : "photo.jpg");
  try {
    const response = await fetcher(`https://graph.facebook.com/${version}/${phone}/media`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(25000) });
    const result = await response.json();
    if (!response.ok || !/^\d{1,80}$/.test(result.id || "")) throw Error("Rejected");
    return result.id;
  } catch { throw new ApiError(502, "Media upload failed. No customer message was sent."); }
}
export async function downloadWhatsAppVideo(mediaId, fetcher = fetch) {
  if (!/^\d{1,80}$/.test(mediaId || "")) throw new ApiError(400, "Invalid media reference");
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN, version = process.env.META_GRAPH_API_VERSION;
  const options = { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(15000) };
  const meta = await fetcher(`https://graph.facebook.com/${version}/${mediaId}`, options);
  if (!meta.ok) throw new ApiError(404, "Video unavailable or expired");
  const data = await meta.json(); let url;
  try { url = new URL(data.url); } catch { throw new ApiError(400, "Invalid media URL"); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !["facebook.com", "fbcdn.net", "fbsbx.com"].some(host => url.hostname === host || url.hostname.endsWith(`.${host}`)) || data.mime_type !== "video/mp4" || !Number.isFinite(Number(data.file_size)) || Number(data.file_size) > 16 * 1024 * 1024) throw new ApiError(400, "Unsupported Meta video");
  const response = await fetcher(url.href, options);
  if (!response.ok || Number(response.headers.get("content-length")) > 16 * 1024 * 1024) throw new ApiError(404, "Video unavailable or expired");
  const chunks = []; let size = 0;
  for await (const chunk of response.body) { size += chunk.length; if (size > 16 * 1024 * 1024) throw new ApiError(400, "Video exceeds 16 MB"); chunks.push(chunk); }
  return Buffer.concat(chunks);
}
