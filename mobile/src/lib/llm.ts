import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {
  getActiveProvider,
  getApiKey,
  getModel,
  isLlmReady,
  type ProviderId,
} from './providers';
import {
  getCachedLlmResponse,
  putCachedLlmResponse,
} from './database';

export type LlmFeature =
  | 'copilot_intent'
  | 'copilot_phrase'
  | 'explain'
  | 'monthly_report';

export interface LlmRequest {
  feature: LlmFeature;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  cacheTtlMs?: number;
}

export type LlmResult =
  | { text: string; cached: boolean; provider: ProviderId }
  | { fallback: true; reason: string };

const RATE_WINDOW_MS = 60 * 60 * 1000;
const RATE_MAX = 30;
const RATE_KEY_PREFIX = 'finance_tracker.llm.rate.';
const REQUEST_TIMEOUT_MS = 20_000;

// ────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────
export async function callLlm(req: LlmRequest): Promise<LlmResult> {
  try {
    if (!(await isLlmReady())) {
      return { fallback: true, reason: 'not_configured' };
    }

    const provider = (await getActiveProvider())!;
    const key = (await getApiKey(provider))!;
    const model = await getModel(provider);

    if (!(await checkRateLimit(req.feature))) {
      return { fallback: true, reason: 'rate_limited' };
    }

    const cacheKey = await hashKey(req.feature, req.userPrompt);
    const cached = await getCachedLlmResponse(cacheKey);
    if (cached) return { text: cached, cached: true, provider };

    const maxTokens = Math.min(req.maxTokens ?? 200, 500);
    const text = await callProvider(
      provider,
      key,
      model,
      req.systemPrompt,
      req.userPrompt,
      maxTokens,
    );

    if (!text) return { fallback: true, reason: 'empty' };

    const ttl = req.cacheTtlMs ?? 5 * 60 * 1000;
    await putCachedLlmResponse(cacheKey, req.feature, text, ttl);

    return { text, cached: false, provider };
  } catch (e) {
    return { fallback: true, reason: 'error' };
  }
}

// ────────────────────────────────────────────────────────────
// Rate limiting — sliding hourly window
// ────────────────────────────────────────────────────────────
async function checkRateLimit(feature: LlmFeature): Promise<boolean> {
  const countKey = RATE_KEY_PREFIX + feature + '.count';
  const windowKey = RATE_KEY_PREFIX + feature + '.window';
  const now = Date.now();

  const windowStr = await SecureStore.getItemAsync(windowKey);
  const windowStart = windowStr ? parseInt(windowStr, 10) : 0;

  let count = parseInt((await SecureStore.getItemAsync(countKey)) || '0', 10);

  if (!windowStart || now - windowStart > RATE_WINDOW_MS) {
    count = 0;
    await SecureStore.setItemAsync(windowKey, String(now));
  }

  if (count >= RATE_MAX) return false;

  await SecureStore.setItemAsync(countKey, String(count + 1));
  return true;
}

async function hashKey(feature: string, prompt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    feature + '|' + prompt,
  );
}

// ────────────────────────────────────────────────────────────
// Provider adapters
// ────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────
// Provider adapters (with diagnostics)
// ────────────────────────────────────────────────────────────
async function callProvider(
  provider: ProviderId,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  try {
    if (provider === 'gemini') {
      return await callGemini(apiKey, model, system, user, maxTokens);
    }
    if (provider === 'groq') {
      return await callOpenAICompatible(
        'https://api.groq.com/openai/v1/chat/completions',
        apiKey,
        model,
        system,
        user,
        maxTokens,
        {},
        'groq',
      );
    }
    return await callOpenAICompatible(
      'https://openrouter.ai/api/v1/chat/completions',
      apiKey,
      model,
      system,
      user,
      maxTokens,
      {
        'HTTP-Referer': 'https://finance-tracker.app',
        'X-Title': 'Paisora AI',
      },
      'openrouter',
    );
  } catch (e) {
    console.log('[LLM] callProvider threw:', e);
    return null;
  }
}

async function callGemini(
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string | null> {
  const url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    model +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
    },
  };

  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  console.log('[LLM][gemini] status:', res.status);
  console.log('[LLM][gemini] body:', text.slice(0, 500));

  if (!res.ok) return null;

  try {
    const json = JSON.parse(text);
    const candidate = json?.candidates?.[0];
    const parts = candidate?.content?.parts;
    const out = parts?.[0]?.text;
    if (typeof out === 'string') return out.trim();
    console.log('[LLM][gemini] unexpected shape:', JSON.stringify(json).slice(0, 400));
    return null;
  } catch (e) {
    console.log('[LLM][gemini] parse error:', e);
    return null;
  }
}

async function callOpenAICompatible(
  url: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
  extraHeaders: Record<string, string>,
  label: string,
): Promise<string | null> {
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
      ...extraHeaders,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  const text = await res.text();
  console.log(`[LLM][${label}] status:`, res.status);
  console.log(`[LLM][${label}] body:`, text.slice(0, 500));

  if (!res.ok) return null;

  try {
    const json = JSON.parse(text);
    const out = json?.choices?.[0]?.message?.content;
    if (typeof out === 'string') return out.trim();
    console.log(`[LLM][${label}] unexpected shape:`, JSON.stringify(json).slice(0, 400));
    return null;
  } catch (e) {
    console.log(`[LLM][${label}] parse error:`, e);
    return null;
  }
}


async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────
// Privacy scrubbing
// ────────────────────────────────────────────────────────────
export function scrubForPrivacy(
  text: string,
  level: 'strict' | 'balanced' | 'rich',
): string {
  if (level === 'rich') return text;
  if (level === 'balanced') {
    // strip 12+ digit sequences and email addresses
    return text
      .replace(/\b\d{12,}\b/g, '[redacted]')
      .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[redacted]');
  }
  // strict — also strip card numbers and phone numbers
  return text
    .replace(/\b\d{10,}\b/g, '[redacted]')
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[redacted]');
}

// ────────────────────────────────────────────────────────────
// Connectivity probe (used by settings UI)
// ────────────────────────────────────────────────────────────
// export async function testConnection(): Promise<{ ok: boolean; message: string }> {
//   try {
//     if (!(await isLlmReady())) {
//       return { ok: false, message: 'No provider or API key configured.' };
//     }
//     const result = await callLlm({
//       feature: 'copilot_phrase',
//       systemPrompt: 'Reply with the single word: ok',
//       userPrompt: 'ping',
//       maxTokens: 10,
//       cacheTtlMs: 0,
//     });
//     if ('fallback' in result) {
//       return { ok: false, message: 'Request failed: ' + result.reason };
//     }
//     return { ok: true, message: 'Connected via ' + result.provider };
//   } catch (e) {
//     return { ok: false, message: e instanceof Error ? e.message : 'Unknown error' };
//   }
// }


export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    if (!(await isLlmReady())) {
      return { ok: false, message: 'No provider or API key configured.' };
    }
    const provider = await getActiveProvider();
    const key = await getApiKey(provider!);
    const model = await getModel(provider!);

    console.log('[LLM] test → provider:', provider, 'model:', model, 'keyLen:', key?.length);

    const result = await callLlm({
      feature: 'copilot_phrase',
      systemPrompt: 'Reply with the single word: ok',
      userPrompt: 'ping',
      maxTokens: 10,
      cacheTtlMs: 0,
    });

    if ('fallback' in result) {
      return { ok: false, message: 'Failed: ' + result.reason + ' — check Metro logs' };
    }
    return { ok: true, message: 'Connected via ' + result.provider };
  } catch (e) {
    console.log('[LLM] test threw:', e);
    return { ok: false, message: e instanceof Error ? e.message : 'Unknown error' };
  }
}