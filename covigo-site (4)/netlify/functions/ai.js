/**
 * Covigo AI Proxy — Netlify Serverless Function
 * Tries multiple Gemini model names until one works
 */

exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GEMINI_API_KEY not set in Netlify environment variables.' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { systemPrompt, history = [] } = body;

  const geminiBody = {
    system_instruction: { parts: [{ text: systemPrompt || 'You are a helpful assistant.' }] },
    contents: history,
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  };

  // Try models in order until one responds successfully
  const MODELS = [
    'gemini-2.0-flash-lite',
    'gemini-2.0-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-flash-8b',
    'gemini-1.5-flash',
    'gemini-pro',
  ];

  let lastError = '';
  for (const model of MODELS) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiBody),
      });
      const data = await res.json();
      if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const reply = data.candidates[0].content.parts[0].text;
        return { statusCode: 200, headers, body: JSON.stringify({ reply, model }) };
      }
      lastError = data?.error?.message || `HTTP ${res.status}`;
      // If it's a quota error, no point trying more models
      if (lastError.includes('quota') || lastError.includes('QUOTA')) break;
    } catch (err) {
      lastError = err.message;
    }
  }

  return { statusCode: 502, headers, body: JSON.stringify({ error: lastError || 'All Gemini models failed.' }) };
};
