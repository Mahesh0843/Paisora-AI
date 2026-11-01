import * as SecureStore from 'expo-secure-store';

export type ProviderId = 'gemini' | 'groq' | 'openrouter';

export interface ProviderDef {
  id: ProviderId;
  label: string;
  helpUrl: string;
  models: string[];
  defaultModel: string;
  keyPrefix?: string;    // for validation
  keyPlaceholder: string;
}

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'gemini',
    label: 'Google Gemini',
    helpUrl: 'https://aistudio.google.com/app/apikey',
    models: ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3.1-flash-lite','gemini-3-flash-preview','gemini-3-pro-preview'],
    defaultModel: 'gemini-3.5-flash-lite',
    keyPlaceholder: 'AIza...',
  },
  {
    id: 'groq',
    label: 'Groq',
    helpUrl: 'https://console.groq.com/keys',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
    ],
    defaultModel: 'llama-3.1-8b-instant',
    keyPrefix: 'gsk_',
    keyPlaceholder: 'gsk_...',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    helpUrl: 'https://openrouter.ai/keys',
    models: [
      'google/gemini-2.0-flash-exp:free',
      'meta-llama/llama-3.1-8b-instruct:free',
      'mistralai/mistral-7b-instruct:free',
    ],
    defaultModel: 'google/gemini-2.0-flash-exp:free',
    keyPrefix: 'sk-or-',
    keyPlaceholder: 'sk-or-...',
  },
];

const PROVIDER_KEY = 'finance_tracker.llm.provider.v1';
const MODEL_KEY_PREFIX = 'finance_tracker.llm.model.';
const API_KEY_PREFIX = 'finance_tracker.llm.key.';

export async function getActiveProvider(): Promise<ProviderId | null> {
  const v = await SecureStore.getItemAsync(PROVIDER_KEY);
  if (v === 'gemini' || v === 'groq' || v === 'openrouter') return v;
  return null;
}

export async function setActiveProvider(id: ProviderId | null): Promise<void> {
  if (id) await SecureStore.setItemAsync(PROVIDER_KEY, id);
  else await SecureStore.deleteItemAsync(PROVIDER_KEY);
}

export async function getApiKey(id: ProviderId): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_PREFIX + id);
}

export async function setApiKey(id: ProviderId, key: string): Promise<void> {
  const trimmed = key.trim();
  if (!trimmed) {
    await SecureStore.deleteItemAsync(API_KEY_PREFIX + id);
    return;
  }
  await SecureStore.setItemAsync(API_KEY_PREFIX + id, trimmed);
}

export async function getModel(id: ProviderId): Promise<string> {
  const stored = await SecureStore.getItemAsync(MODEL_KEY_PREFIX + id);
  if (stored) return stored;
  const def = PROVIDERS.find(p => p.id === id);
  return def?.defaultModel ?? '';
}

export async function setModel(id: ProviderId, model: string): Promise<void> {
  await SecureStore.setItemAsync(MODEL_KEY_PREFIX + id, model);
}

export async function hasKey(id: ProviderId): Promise<boolean> {
  const k = await getApiKey(id);
  return !!(k && k.length > 8);
}

export async function isLlmReady(): Promise<boolean> {
  const provider = await getActiveProvider();
  if (!provider) return false;
  return hasKey(provider);
}