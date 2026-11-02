import test from 'node:test';
import assert from 'node:assert/strict';
import { generateAIReply } from '../backend/src/modules/whatsapp/whatsapp.gemini.js';
const settings = { model: 'gemini-3.1-flash-lite', tone: 'Friendly', instructions: 'Reply briefly.' };
const response = (text, reason = 'STOP') => ({ candidates: [{ finishReason: reason, content: { parts: [{ thought: true, text: 'private reasoning' }, { text }] } }] });
test('thinking budget exhaustion retries generation and keeps thought text private', async () => {
  let calls = 0;
  const result = await generateAIReply(settings, [], 'Hello', async () => ({ models: { generateContent: async ({ config }) => {
    assert.equal(config.thinkingConfig.thinkingLevel, 'MINIMAL');
    calls++;
    assert.equal(config.maxOutputTokens, calls === 1 ? 4096 : 8192);
    return calls === 1 ? response('', 'MAX_TOKENS') : response('Welcome!');
  } } }));
  assert.equal(result, 'Welcome!'); assert.equal(calls, 2);
});
test('truncated and blocked replies never become automatic messages', async () => {
  for (const reason of ['MAX_TOKENS', 'SAFETY', 'PROHIBITED_CONTENT']) {
    let calls = 0;
    await assert.rejects(generateAIReply(settings, [], 'Hi', async () => ({ models: { generateContent: async () => { calls++; return response('partial', reason); } } })), /budget|blocked/);
    assert.equal(calls, reason === 'MAX_TOKENS' ? 2 : 1);
  }
});
test('temporary provider failure retries once and quota errors do not retry', async () => {
  let calls = 0;
  assert.equal(await generateAIReply(settings, [], 'Hi', async () => ({ models: { generateContent: async () => { if (++calls === 1) throw Object.assign(Error('Unavailable'), { status: 503 }); return response('Hello'); } } })), 'Hello');
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(generateAIReply(settings, [], 'Hi', async () => ({ models: { generateContent: async () => { calls++; throw Object.assign(Error('Quota'), { status: 429 }); } } })), /quota/);
  assert.equal(calls, 1);
});
