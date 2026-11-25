// Thin client for Grok (xAI), which speaks the OpenAI-compatible chat API.
// Every function returns null when AI is unavailable so callers can fall back to offline logic.
const API_URL = 'https://api.x.ai/v1/chat/completions';

const enabled = () => Boolean(process.env.XAI_API_KEY && process.env.XAI_MODEL);

async function chat(messages, { json = false, maxTokens = 900, timeoutMs = 30000 } = {}) {
  if (!enabled()) return null;
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.XAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.XAI_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: json ? 0.1 : 0.5,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      console.warn(`[ai] Grok returned ${res.status}: ${(await res.text()).slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn('[ai] Grok call failed:', e.message);
    return null;
  }
}

/** Ask for a JSON object; returns the parsed object or null. */
async function chatJSON(messages, opts) {
  const text = await chat(messages, { ...opts, json: true });
  if (!text) return null;
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ''));
  } catch (_) {
    console.warn('[ai] Grok returned non-JSON output');
    return null;
  }
}

module.exports = { enabled, chat, chatJSON };
