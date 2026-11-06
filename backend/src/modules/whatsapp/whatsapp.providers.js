import { geminiClient, geminiKey, encryptGeminiKey, availableModels, generateAIReply } from "./whatsapp.gemini.js";
import ApiError from "../../utils/ApiError.js";

// Providers implement the same bounded content/tool interface. Catalog validation,
// conversation policy and WhatsApp delivery never depend on a provider SDK.
export const GROQ_TEXT_MODEL = "openai/gpt-oss-20b";
export const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";
const visionModels = new Set([GROQ_VISION_MODEL, "meta-llama/llama-4-scout-17b-16e-instruct", "meta-llama/llama-4-maverick-17b-128e-instruct", "meta-models/muse-spark-open"]);
export const supportsVision = (provider, model) => provider === "gemini" ? /^gemini-/.test(model) && !/tts|audio|embedding/i.test(model) : visionModels.has(model);
export function providerKey(settings, provider = settings?.primaryProvider || "gemini") {
  return provider === "gemini" ? geminiKey(settings) : settings?.encryptedGroqKey ? geminiKey({ encryptedKey: settings.encryptedGroqKey }) : process.env.GROQ_API_KEY || "";
}
export { encryptGeminiKey as encryptProviderKey };
export function providerModel(settings, provider, image = false) {
  return provider === "groq" ? (image ? settings.groqVisionModel || GROQ_VISION_MODEL : settings.groqModel || GROQ_TEXT_MODEL) : settings.model || "gemini-3.1-flash-lite";
}
const limitHeaders = ["x-ratelimit-limit-requests", "x-ratelimit-limit-tokens", "x-ratelimit-remaining-requests", "x-ratelimit-remaining-tokens", "x-ratelimit-reset-requests", "x-ratelimit-reset-tokens", "retry-after"];
async function groqRequest(key, path, body, signal, fetcher = fetch, retried = false) {
  if (!key) throw new ApiError(400, "Add a Groq API key first");
  let response;
  try {
    response = await fetcher(`https://api.groq.com/openai/v1/${path}`, { method: body ? "POST" : "GET", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal: signal || AbortSignal.timeout(20000) });
  } catch (error) { throw Object.assign(new Error("Groq connection unavailable"), { status: 503, name: error.name }); }
  const limits = Object.fromEntries(limitHeaders.filter(name => response.headers.has(name)).map(name => [name, response.headers.get(name)]));
  const retryAfter = Number(response.headers.get("retry-after"));
  if (response.status === 429 && !retried && retryAfter > 0 && retryAfter <= 45 && !signal?.aborted) {
    await new Promise((resolve, reject) => {
      const cancel = () => { clearTimeout(timer); reject(Object.assign(Error("Provider deadline exceeded"), { status: 504 })); };
      const timer = setTimeout(() => { signal?.removeEventListener("abort", cancel); resolve(); }, retryAfter * 1000);
      signal?.addEventListener("abort", cancel, { once: true });
    });
    return groqRequest(key, path, body, signal, fetcher, true);
  }
  if (!response.ok) {
    // Never return raw provider errors: these may echo request content or secrets.
    const details = await response.json().catch(() => ({}));
    const code = details.error?.code;
    const capacity = String(details.error?.message || "").match(/Limit (\d+), Requested (\d+)/);
    if (capacity) { limits["reported-input-token-limit"] = capacity[1]; limits["reported-request-tokens"] = capacity[2]; }
    const failed = String(details.error?.failed_generation || "");
    const failedTools = [...failed.matchAll(/(?:"name"\s*:\s*"|<function=)([A-Za-z_]{1,50})/g)].map(match => match[1]);
    const status = response.status === 400 && ["tool_use_failed", "json_validate_failed"].includes(code) ? 502 : response.status;
    throw Object.assign(new Error(`Groq request failed (${status})`), { status, limits, failedTools, providerCode: typeof code === "string" && /^[a-z_]{1,80}$/.test(code) ? code : undefined });
  }
  return { data: await response.json(), limits };
}
export async function providerModels(settings, provider, keyOverride) {
  const key = keyOverride || providerKey(settings, provider);
  if (provider === "gemini") return { models: await availableModels(key), limits: null, limitsNote: "Account limits are not exposed by the model-list API." };
  if (provider !== "groq") throw new ApiError(400, "Unsupported provider");
  try {
    const { data, limits } = await groqRequest(key, "models");
    const models = (data.data || []).filter(row => row.active !== false && !/guard/i.test(row.id) && /^(openai\/gpt-oss-|qwen\/qwen3\.8-|llama-3\.3-|meta-llama\/llama-4-|meta-models\/muse-spark-open)/.test(row.id)).map(row => row.id);
    return { models, visionModels: models.filter(id => supportsVision("groq", id)), limits, limitsNote: "Only limits returned by Groq are shown; model and account limits may differ." };
  } catch (error) { throw new ApiError(error.status === 429 ? 429 : 400, "Groq connection failed. Check key, access and quota."); }
}
export async function testProviderConnection(settings, provider) {
  const connection = await providerModels(settings, provider);
  const model = providerModel(settings || {}, provider);
  if (!connection.models.includes(model)) throw new ApiError(400, "Selected model is unavailable");
  if (provider === "groq") {
    try {
      const result = await groqRequest(providerKey(settings, provider), "chat/completions", { model, messages: [{ role: "user", content: "Reply with a brief greeting." }], max_completion_tokens: 128, ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : {}) });
      if (!result.data.choices?.[0]?.message?.content) throw Error("Empty reply");
      return { ...connection, limits: result.limits, limitsModel: model };
    } catch (error) { throw new ApiError(error.status === 429 ? 429 : 400, "Groq generation connection failed. Check quota and model access."); }
  }
  await generateProviderReply({ ...settings?.toObject?.() || settings, primaryProvider: provider, fallbackProvider: "none" }, [], "Reply briefly in Bangla.");
  return connection;
}
const schema = value => Array.isArray(value) ? value.map(schema) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, key === "type" && typeof item === "string" ? item.toLowerCase() : schema(item)])) : value;
export function groqClient(key, fetcher = fetch) {
  return { models: { generateContent: async ({ model, contents, config }) => {
    const declarations = config.tools?.flatMap(tool => tool.functionDeclarations) || [];
    const allowed = config.toolConfig?.functionCallingConfig?.allowedFunctionNames;
    const messages = [{ role: "system", content: config.systemInstruction }];
    let imageCount = 0;
    for (const content of contents) {
      for (const { functionResponse: result } of content.parts.filter(part => part.functionResponse)) messages.push({ role: "tool", tool_call_id: result.id, content: JSON.stringify(result.response) });
      const calls = content.parts.filter(part => part.functionCall).map(({ functionCall: call }) => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } }));
      const parts = content.parts.filter(part => part.text || (part.inlineData && imageCount++ < 1)).map(part => part.inlineData ? { type: "image_url", image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` } } : { type: "text", text: part.text });
      if (parts.length || calls.length) messages.push({ role: content.role === "model" ? "assistant" : "user", content: parts.length ? parts : null, ...(calls.length ? { tool_calls: calls } : {}) });
    }
    const onlyFinish = allowed?.length === 1;
    const tools = declarations.filter(tool => !onlyFinish || allowed.includes(tool.name)).map(tool => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: schema(tool.parameters) } }));
    if (allowed) messages[0].content += `\nAllowed next functions: ${allowed.join(", ")}.`;
    const { data } = await groqRequest(key, "chat/completions", { model, messages, temperature: 0, max_completion_tokens: Math.min(config.maxOutputTokens || 1024, 1024), ...(/gpt-oss/.test(model) ? { reasoning_effort: "low" } : /^qwen\//.test(model) ? { reasoning_effort: "none", reasoning_format: "hidden" } : {}), ...(tools.length ? { tools, tool_choice: "auto", parallel_tool_calls: false } : {}) }, config.abortSignal, fetcher);
    const choice = data.choices?.[0];
    let parts;
    try { parts = (choice?.message?.tool_calls || []).map(call => ({ functionCall: { id: call.id, name: call.function.name, args: JSON.parse(call.function.arguments) } })); }
    catch { throw new ApiError(400, "AI returned invalid tool arguments"); }
    if (choice?.message?.content) parts.push({ text: choice.message.content });
    return { candidates: [{ finishReason: ["stop", "tool_calls"].includes(choice?.finish_reason) ? "STOP" : "INCOMPLETE", content: { role: "model", parts } }], usageMetadata: { promptTokenCount: data.usage?.prompt_tokens || 0, candidatesTokenCount: data.usage?.completion_tokens || 0 } };
  } } };
}
export async function withProvider(settings, image, generate, factories = {}) {
  const primary = settings.primaryProvider || "gemini";
  const fallback = settings.fallbackProvider || "none";
  const providers = [...new Set([primary, fallback])].filter(provider => provider !== "none");
  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index], model = providerModel(settings, provider, image);
    if (!providerKey(settings, provider) || (image && !supportsVision(provider, model))) {
      if (index + 1 < providers.length) continue;
      throw new ApiError(400, "No configured provider supports this input. Check AI Settings.");
    }
    try {
      const factory = factories[provider] || (provider === "groq" ? groqClient : geminiClient);
      return await generate({ ...settings.toObject?.() || settings, model, providerComparisonLimit: provider === "groq" ? 0 : 3, providerTimeoutMs: providers.length > 1 ? 30000 : 55000 }, () => factory(providerKey(settings, provider)), provider);
    } catch (error) {
      const status = Number(error.providerStatus || error.status || error.statusCode);
      const temporary = [429, 500, 502, 503, 504].includes(status) || ["AbortError", "TimeoutError"].includes(error.name);
      if (temporary && index + 1 < providers.length) continue;
      if (error instanceof ApiError) {
        if (provider === "groq") error.message = error.message.replaceAll("Gemini", "Groq").replaceAll("Google AI Studio", "Groq Console");
        throw error;
      }
      throw Object.assign(new ApiError(status === 429 ? 429 : temporary ? 503 : 400, `${provider === "groq" ? "Groq" : "Gemini"} could not generate a reply (${status || "unavailable"}). No WhatsApp message was sent.`), { limits: error.limits, providerCode: error.providerCode });
    }
  }
}
export function generateProviderReplyResult(settings, history, prompt) {
  return withProvider(settings, false, async (selected, factory, provider) => ({ reply: await generateAIReply(selected, history, prompt, factory), provider, model: selected.model }));
}
export async function generateProviderReply(settings, history, prompt) {
  return (await generateProviderReplyResult(settings, history, prompt)).reply;
}
