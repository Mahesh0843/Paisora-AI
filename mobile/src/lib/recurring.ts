import type { Category, Transaction } from './model';

export interface Recurring {
  id: string;
  merchant: string;
  normalizedMerchant: string;
  amountPaise: number;
  amountVaries: boolean;
  direction: 'debit' | 'credit';
  category: Category;
  intervalDays: number;
  intervalLabel: 'weekly' | 'semi-monthly' | 'monthly' | 'quarterly' | 'annual';
  occurrences: number;
  lastSeen: number;
  nextExpected: number;
  kind: 'subscription' | 'emi' | 'rent' | 'salary' | 'sip' | 'utility' | 'other';
  confidence: number;
}

function median(arr: number[]): number {
  const s = [...arr].sort((a, b) => a - b);
  const n = s.length;
  if (n % 2 === 1) return s[Math.floor(n / 2)];
  return (s[n / 2 - 1] + s[n / 2]) / 2;
}

function stddev(arr: number[]): number {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / arr.length;
  return Math.sqrt(variance);
}

function sha1Simple(str: string): string {
  // Simple deterministic hash using crypto if available; fallback to stable string
  return `rec_${str.toLowerCase().replace(/\s+/g, '')}`;
}

export function detectRecurring(transactions: Transaction[]): Recurring[] {
  const filtered = transactions.filter(t => t.status !== 'ignored');
  const groups = new Map<string, Transaction[]>();
  for (const t of filtered) {
    const norm = t.merchant.toLowerCase().replace(/\s+/g, '');
    const key = `${norm}|${t.direction}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  const results: Recurring[] = [];

  for (const [key, group] of groups) {
    if (group.length < 3) continue;
    const sorted = group.sort((a, b) => a.occurredAt - b.occurredAt);

    const intervals: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      intervals.push((sorted[i + 1].occurredAt - sorted[i].occurredAt) / 86_400_000);
    }
    if (intervals.length === 0) continue;

    const meanInt = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const stdInt = stddev(intervals);
    const intervalCV = meanInt > 0 ? stdInt / meanInt : Infinity;
    if (intervalCV > 0.25) continue;

    const medianInt = median(intervals);
    let intervalLabel: Recurring['intervalLabel'] | null = null;
    if (medianInt >= 6 && medianInt <= 8) intervalLabel = 'weekly';
    else if (medianInt >= 13 && medianInt <= 17) intervalLabel = 'semi-monthly';
    else if (medianInt >= 25 && medianInt <= 35) intervalLabel = 'monthly';
    else if (medianInt >= 85 && medianInt <= 95) intervalLabel = 'quarterly';
    else if (medianInt >= 355 && medianInt <= 375) intervalLabel = 'annual';
    if (!intervalLabel) continue;

    const amountVals = sorted.map(t => t.amountPaise);
    const meanAmt = amountVals.reduce((a, b) => a + b, 0) / amountVals.length;
    const stdAmt = stddev(amountVals);
    const amountCV = meanAmt > 0 ? stdAmt / meanAmt : Infinity;
    const amountVaries = amountCV > 0.15;
    if (amountCV > 0.40 && !(sorted.some(t => t.category === 'Bills') && amountVaries)) continue;

    const normMerchant = sorted[0].merchant.toLowerCase().replace(/\s+/g, '');
    const direction = sorted[0].direction;

    let kind: Recurring['kind'] = 'other';
    if (direction === 'credit' && meanAmt > 50000 && intervalLabel === 'monthly') kind = 'salary';
    else if (sorted[0].category === 'EMI & loans') kind = 'emi';
    else if (sorted[0].category === 'Bills' && amountVaries) kind = 'utility';
    else if (sorted[0].category === 'Investment') kind = 'sip';
    else if (sorted[0].category === 'Bills' && normMerchant.includes('rent') || normMerchant.includes('landlord')) kind = 'rent';
    else if (!amountVaries && (intervalLabel === 'monthly' || intervalLabel === 'weekly')) kind = 'subscription';

    const occurrences = sorted.length;
    const confidence = Math.min(1, Math.max(0,
      0.4 + 0.3 * Math.min(occurrences / 6, 1) + 0.2 * (1 - intervalCV) + 0.1 * (amountVaries ? 0.5 : 1)
    ));
    if (confidence < 0.55) continue;

    const medianAmt = median(amountVals);
    const lastSeen = Math.max(...sorted.map(t => t.occurredAt));
    const intervalDays = Math.round(medianInt);

    const categoryCounts = new Map<string, number>();
    for (const t of sorted) {
      categoryCounts.set(t.category, (categoryCounts.get(t.category) || 0) + 1);
    }
    let modeCategory = sorted[0].category as Category;
    let maxCount = 0;
    for (const [cat, count] of categoryCounts) {
      if (count > maxCount) { maxCount = count; modeCategory = cat as Category; }
    }

    results.push({
      id: `rec_${normMerchant}_${direction}`,
      merchant: sorted[0].merchant,
      normalizedMerchant: normMerchant,
      amountPaise: Math.round(medianAmt),
      amountVaries,
      direction,
      category: modeCategory,
      intervalDays,
      intervalLabel,
      occurrences,
      lastSeen,
      nextExpected: lastSeen + intervalDays * 86_400_000,
      kind,
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  return results.sort((a, b) => a.nextExpected - b.nextExpected);
}
