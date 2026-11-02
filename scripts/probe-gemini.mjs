// Azure app settings arrive on stdin; credentials and customer history never leave memory.
import mongoose from '../backend/node_modules/mongoose/index.js';
import { AISettings } from '../backend/src/modules/whatsapp/whatsapp.model.js';
import { generateAIReply, availableModels } from '../backend/src/modules/whatsapp/whatsapp.gemini.js';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
let input = ''; for await (const chunk of process.stdin) input += chunk;
const parsed = JSON.parse(input), entries = Array.isArray(parsed) ? parsed : parsed.value;
for (const { name, value } of entries) process.env[name] = value;
await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  const store = await mongoose.connection.db.collection('stores').findOne({ slug: 'originsofbeauty' });
  const settings = await AISettings.findOne({ store: store._id }).select('+encryptedKey');
  if (!settings) throw Error('No saved AI settings');
  if (process.argv.includes('--models')) {
    const { geminiKey } = await import('../backend/src/modules/whatsapp/whatsapp.gemini.js');
    console.log(JSON.stringify({ availableModels: await availableModels(geminiKey(settings)) }));
  }
  const models = process.argv.filter(arg => arg.startsWith('--model=')).map(arg => arg.slice(8));
  for (const model of models.length ? models : [settings.model]) {
    const start = Date.now();
    try {
      const prompt = process.argv.find(arg => arg.startsWith('--prompt='))?.slice(9) || 'Hello! Please introduce the store briefly in Bangla.';
      let reply;
      const endpoint = process.argv.find(arg => arg.startsWith('--endpoint='))?.slice(11);
      if (endpoint) {
        const admin = await mongoose.connection.db.collection('users').findOne({ tenantId: store._id, role: 'ADMIN' }, { projection: { _id: 1 } });
        const access = jwt.sign({ _id: String(admin._id) }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '2m' });
        const response = await fetch(`${endpoint}/api/v1/whatsapp/ai/preview`, { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', 'X-Store-Slug': 'originsofbeauty' }, body: JSON.stringify({ prompt }), signal: AbortSignal.timeout(65000) });
        const body = await response.json();
        if (!response.ok) throw Error(body.message || `Preview failed (${response.status})`);
        reply = body.data.reply;
      } else reply = await generateAIReply({ ...settings.toObject(), model }, [], prompt);
      if (!reply?.trim()) throw Error('Blank Gemini response');
      console.log(JSON.stringify({ model, success: true, durationMs: Date.now() - start, reply }));
      if (process.argv.includes('--activate')) {
        await AISettings.updateOne({ _id: settings._id, revision: settings.revision }, { $set: { model, connectionState: 'connected', connectedAt: new Date() }, $inc: { revision: 1 } });
        console.log('Verified model saved. Existing global and conversation switches preserved.');
      }
    } catch (error) { console.log(JSON.stringify({ model, success: false, durationMs: Date.now() - start, error: error.message })); process.exitCode = 1; }
  }
} finally { await mongoose.disconnect(); }
