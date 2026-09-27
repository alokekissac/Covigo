/**
 * Covigo AI proxy — Netlify serverless function.
 *
 * Browser  →  POST /api/ai  →  this function  →  Gemini API
 * The Gemini key lives only in the GEMINI_API_KEY environment variable.
 *
 * Optional env vars:
 *   GEMINI_MODEL   comma-separated model list to try in order
 *                  (default: gemini-flash-lite-latest, gemini-3.1-flash-lite, gemini-3.6-flash)
 */

const DEFAULT_MODELS = ['gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];
const MAX_TURNS = 24;          // history entries accepted per request
const MAX_TEXT = 2000;         // characters per message
const MAX_SYSTEM = 4000;       // characters in the system prompt
const TIMEOUT_MS = 15000;

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (statusCode, obj) => ({ statusCode, headers, body: JSON.stringify(obj) });

exports.handler = async function (event) {
  // The app calls this endpoint from the same origin, so no CORS headers are
  // needed. Leaving CORS closed stops other sites from spending your quota.
  if (event.httpMethod !== 'POST') return reply(405, { error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return reply(500, { error: 'GEMINI_API_KEY is not set in the Netlify environment variables.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON' }); }

  const systemPrompt = String(body.systemPrompt || 'You are a helpful assistant.').slice(0, MAX_SYSTEM);
  const history = Array.isArray(body.history) ? body.history.slice(-MAX_TURNS) : [];

  // Keep only well-formed turns: {role: 'user'|'model', parts: [{text}]}
  const contents = history
    .filter((t) => t && (t.role === 'user' || t.role === 'model') && Array.isArray(t.parts))
    .map((t) => ({
      role: t.role,
      parts: t.parts.filter((p) => p && typeof p.text === 'string').map((p) => ({ text: p.text.slice(0, MAX_TEXT) })),
    }))
    .filter((t) => t.parts.length);

  if (!contents.length || contents[contents.length - 1].role !== 'user') {
    return reply(400, { error: 'The last message must be from the user.' });
  }

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  };

  const models = (process.env.GEMINI_MODEL || '').split(',').map((m) => m.trim()).filter(Boolean);
  let lastError = '';

  for (const model of models.length ? models : DEFAULT_MODELS) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const data = await res.json().catch(() => ({}));
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
      if (res.ok && text) return reply(200, { reply: text, model });

      lastError = data?.error?.message || `HTTP ${res.status}`;
      // Retrying other models won't help with a bad key or an exhausted quota.
      if ([400, 401, 403, 429].includes(res.status) && !/not found|not supported/i.test(lastError)) break;
    } catch (err) {
      lastError = err.name === 'TimeoutError' ? 'Gemini request timed out' : err.message;
    }
  }

  return reply(502, { error: lastError || 'All Gemini models failed.' });
};
