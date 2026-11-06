import { systemInstruction, conversationContents } from "./whatsapp.instructions.js";
export { systemInstruction, conversationContents } from "./whatsapp.instructions.js";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import ApiError from "../../utils/ApiError.js";
function encryptionKey() {
  const key = Buffer.from(process.env.WHATSAPP_AI_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw new ApiError(503, "AI key storage is not configured on the backend");
  return key;
}
export function encryptGeminiKey(value) {
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString("base64")).join(".");
}
export function geminiKey(settings) {
  if (!settings?.encryptedKey) return process.env.GEMINI_API_KEY || "";
  const [iv, tag, body] = settings.encryptedKey.split(".").map(value => Buffer.from(value, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
}
export async function geminiClient(key) {
  if (!key) throw new ApiError(400, "Add a Gemini API key first");
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 30000, retryOptions: { attempts: 1 } } });
}
export async function availableModels(key) {
  try {
    const client = await geminiClient(key);
    const pager = await client.models.list({ config: { pageSize: 1000, httpOptions: { timeout: 15000 } } });
    const models = [];
    for await (const model of pager) {
      const id = model.name?.replace(/^models\//, "");
      if (id && /^gemini-[a-z0-9.-]+$/i.test(id) && id.includes("flash") && !/image|audio|tts|live|computer|preview/i.test(id) && model.supportedActions?.includes("generateContent")) models.push(id);
      if (models.length >= 100) break;
    }
    return models;
  } catch { throw new ApiError(400, "Gemini connection failed. Check your API key, API access and billing."); }
}
export async function generateAIReply(settings, history, prompt, clientFactory = geminiClient) {
  try {
    const client = await clientFactory(clientFactory === geminiClient ? geminiKey(settings) : undefined);
    const thinkingConfig = /^gemini-3\.(1|5)-flash-lite/.test(settings.model) ? { thinkingLevel: "MINIMAL" } : /^gemini-[3-9]/.test(settings.model) ? { thinkingLevel: "LOW" } : /^gemini-2\.5/.test(settings.model) ? { thinkingBudget: 0 } : undefined;
    const abortSignal = AbortSignal.timeout(settings.providerTimeoutMs || 55000);
    const contents = conversationContents(history, prompt);
    const config = { systemInstruction: systemInstruction(settings) + "\nKeep each reply under 600 characters unless the customer explicitly needs more detail.", maxOutputTokens: 4096, thinkingConfig, temperature: 0.5, abortSignal };
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        result = await client.models.generateContent({ model: settings.model, contents, config });
        if (result.candidates?.[0]?.finishReason !== "MAX_TOKENS" || attempt === 1) break;
        // Thinking uses the same output budget. Retry generation, never a WhatsApp send.
        config.maxOutputTokens = 8192;
      } catch (error) {
        if (attempt || ![500, 502, 503].includes(Number(error.status)) || abortSignal.aborted) throw error;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    if (result.candidates?.[0]?.finishReason === "MAX_TOKENS") throw new ApiError(400, "Gemini reached its response budget. Try shorter instructions or a Flash-Lite model; no WhatsApp message was sent.");
    if (result.promptFeedback?.blockReason || ["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT"].includes(result.candidates?.[0]?.finishReason)) throw new ApiError(400, "Gemini blocked this response. Review the instructions and customer request; no WhatsApp message was sent.");
    const parts = result.candidates?.[0]?.content?.parts;
    const text = (parts ? parts.filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("") : result.text || "").trim();
    if (!text) throw new ApiError(400, "Gemini returned no reply text. Try the preview or a Flash-Lite model; no WhatsApp message was sent.");
    if (text.length > 4096) throw new ApiError(400, "Gemini's reply exceeded WhatsApp's text limit. Request shorter replies in AI Settings.");
    return text;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    let provider; try { provider = JSON.parse(error.message)?.error; } catch {}
    const status = Number(error.status || provider?.code);
    if (status === 413) throw new ApiError(429, "AI provider input token limit reached. No WhatsApp message was sent.");
    if (status === 429) throw new ApiError(429, "Gemini quota or rate limit reached. Check Google AI Studio usage/billing; no WhatsApp message was sent.");
    if ([401, 403].includes(status)) throw new ApiError(400, "Gemini rejected the API key or project permissions. Check the key and API access in AI Settings.");
    if (status === 404) throw new ApiError(400, "The selected Gemini model is unavailable. Check the connection and select an available model.");
    if (["AbortError", "TimeoutError"].includes(error.name) || status === 504) throw new ApiError(504, "Gemini timed out. Try shorter instructions or a Flash-Lite model; no WhatsApp message was sent.");
    if ([500, 502, 503, 504].includes(status)) throw new ApiError(503, "Gemini is temporarily unavailable. No WhatsApp message was sent; try the preview again later.");
    throw new ApiError(400, "Gemini generation failed. Check the saved key/model using Test AI Response; no WhatsApp message was sent.");
  }
}
