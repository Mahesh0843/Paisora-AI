import type { Category, Transaction } from './model';
import { callLlm, scrubForPrivacy } from './llm';
import { loadPreferences } from './database';

export interface CopilotIntent {
  intent: 'sum' | 'list' | 'top' | 'compare' | 'balance' | 'afford' | 'unknown';
  filters: {
    category?: Category;
    merchant?: string;
    direction?: 'debit' | 'credit';
    dateFrom?: number;
    dateTo?: number;
  };
  aggregation?: 'sum' | 'count' | 'average' | 'max' | 'min';
  topN?: number;
  compareTo?: { dateFrom: number; dateTo: number };
}

export async function answerQuestion(
  question: string,
  transactions: Transaction[],
): Promise<{ text: string; cached: boolean; fallback: boolean }> {
  if (transactions.length === 0) {
    return {
      text: "You don't have any transactions yet. Scan your bank SMS first.",
      cached: false,
      fallback: true,
    };
  }

  const prefs = await loadPreferences();
  const intent = await extractIntent(question, prefs.llmPrivacyLevel);
  if (!intent || intent.intent === 'unknown') {
    return {
      text: "I couldn't understand that. Try asking 'How much did I spend on food this month?'",
      cached: false,
      fallback: true,
    };
  }

  const result = runIntent(intent, transactions);
  if (result.count === 0) {
    return {
      text: 'No matching transactions found.',
      cached: false,
      fallback: true,
    };
  }

  const phrase = await callLlm({
    feature: 'copilot_phrase',
    systemPrompt:
      "You phrase finance data into a single natural sentence for the user. " +
      "Use ONLY the numbers and merchant names provided. Never invent values. " +
      "Keep it under 25 words. No financial advice.",
    userPrompt: `Question: ${question}\nData: ${result.summary}`,
    maxTokens: 80,
  });

  if ('fallback' in phrase) {
    return { text: templateFor(intent, result), cached: false, fallback: true };
  }
  return { text: phrase.text, cached: phrase.cached, fallback: false };
}

async function extractIntent(
  question: string,
  privacyLevel: 'strict' | 'balanced' | 'rich',
): Promise<CopilotIntent | null> {
  const today = Date.now();
  const systemPrompt =
    'You extract structured intent from a user question about their spending. ' +
    'Return ONLY a JSON object with this shape:\n' +
    "{ intent: 'sum'|'list'|'top'|'compare'|'balance'|'afford'|'unknown', " +
    "filters: { category?: string, merchant?: string, " +
    "direction?: 'debit'|'credit', dateFrom?: number, dateTo?: number }, " +
    "aggregation?: 'sum'|'count'|'average'|'max'|'min', topN?: number }\n" +
    'All dates are Unix epoch milliseconds. Today is ' + today + '.\n' +
    "The user's categories are: Food & dining, Groceries, Travel, Bills, " +
    'Shopping, Health, Entertainment, Transfers, EMI & loans, Salary, ' +
    'Investment, Cash withdrawal, Other.\n' +
    'Output JSON only. No markdown fences. No explanation.';

  const scrubbed = scrubForPrivacy(question, privacyLevel);
  const res = await callLlm({
    feature: 'copilot_intent',
    systemPrompt,
    userPrompt: scrubbed,
    maxTokens: 150,
    cacheTtlMs: 60_000,
  });
  if ('fallback' in res) return null;

  try {
    const cleaned = res.text.replace(/^```json|```$/g, '').trim();
    const parsed = JSON.parse(cleaned) as CopilotIntent;
    // Sanity clamps
    if (parsed.topN && parsed.topN > 50) parsed.topN = 50;
    return parsed;
  } catch {
    return null;
  }
}

function runIntent(
  intent: CopilotIntent,
  all: Transaction[],
): { count: number; summary: string; items: Transaction[] } {
  const filtered = all.filter(t => {
    if (intent.filters.direction && t.direction !== intent.filters.direction)
      return false;
    if (intent.filters.category && t.category !== intent.filters.category)
      return false;
    if (intent.filters.merchant) {
      const q = intent.filters.merchant.toLowerCase();
      if (!t.merchant.toLowerCase().includes(q)) return false;
    }
    if (intent.filters.dateFrom && t.occurredAt < intent.filters.dateFrom)
      return false;
    if (intent.filters.dateTo && t.occurredAt > intent.filters.dateTo)
      return false;
    return true;
  });

  const sumPaise = filtered.reduce((a, t) => a + t.amountPaise, 0);
  const avgPaise = filtered.length
    ? Math.round(sumPaise / filtered.length)
    : 0;

  let items = filtered;
  if (intent.intent === 'top') {
    items = [...filtered]
      .sort((a, b) => b.amountPaise - a.amountPaise)
      .slice(0, intent.topN ?? 5);
  }

  // IMPORTANT: send RUPEES to the LLM, not paise.
  // Internally everything stays in paise; only the LLM-facing JSON
  // converts. Field names are suffixed with 'Rupees' so the model has
  // zero ambiguity about units.
  const summary = JSON.stringify({
    sumRupees: (sumPaise / 100).toFixed(2),
    avgRupees: (avgPaise / 100).toFixed(2),
    count: filtered.length,
    direction: intent.filters.direction ?? 'any',
    category: intent.filters.category ?? null,
    top: items.slice(0, 5).map(t => ({
      merchant: t.merchant,
      amountRupees: (t.amountPaise / 100).toFixed(2),
      date: new Date(t.occurredAt).toISOString().slice(0, 10),
    })),
  });

  return { count: filtered.length, summary, items };
}

function templateFor(
  intent: CopilotIntent,
  result: { count: number; summary: string },
): string {
  const data = JSON.parse(result.summary);

  // data.sumRupees is a string like "1200.00"
  const rupees = Number(data.sumRupees).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (intent.intent === 'sum') {
    if (intent.filters.category)
      return `You spent ₹${rupees} on ${intent.filters.category}.`;
    return `You spent ₹${rupees} in total.`;
  }

  if (intent.intent === 'top') {
    const first = data.top?.[0];
    if (first) {
      const amt = Number(first.amountRupees).toLocaleString('en-IN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      return `Your biggest expense was ₹${amt} at ${first.merchant}.`;
    }
  }

  return `${result.count} transactions totaling ₹${rupees}.`;
}