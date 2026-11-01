import assert from 'node:assert/strict';
import test from 'node:test';
import { detectRecurring } from '../src/lib/recurring';

test('Test 1 — Detect Netflix subscription', () => {
  const transactions = [
    { id: 't1', merchant: 'NETFLIX', amountPaise: 64900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-01-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'NETFLIX', amountPaise: 64900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-02-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't3', merchant: 'NETFLIX', amountPaise: 64900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-03-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't4', merchant: 'NETFLIX', amountPaise: 64900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-04-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  const result = detectRecurring(transactions as any);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'subscription');
  assert.equal(result[0].intervalLabel, 'monthly');
  assert.equal(result[0].amountPaise, 64900);
  assert.equal(result[0].occurrences, 4);
});

test('Test 2 — Reject irregular merchant', () => {
  const transactions = [
    { id: 't1', merchant: 'AMAZON', amountPaise: 120000, direction: 'debit', category: 'Shopping', occurredAt: new Date('2026-01-05').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'AMAZON', amountPaise: 95000, direction: 'debit', category: 'Shopping', occurredAt: new Date('2026-02-20').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't3', merchant: 'AMAZON', amountPaise: 110000, direction: 'debit', category: 'Shopping', occurredAt: new Date('2026-03-10').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't4', merchant: 'AMAZON', amountPaise: 130000, direction: 'debit', category: 'Shopping', occurredAt: new Date('2026-04-25').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  assert.equal(detectRecurring(transactions as any).length, 0);
});

test('Test 3 — Detect salary', () => {
  const transactions = [
    { id: 't1', merchant: 'ACME CORP', amountPaise: 5000000, direction: 'credit', category: 'Transfers', occurredAt: new Date('2026-01-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'ACME CORP', amountPaise: 5000000, direction: 'credit', category: 'Transfers', occurredAt: new Date('2026-02-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't3', merchant: 'ACME CORP', amountPaise: 5000000, direction: 'credit', category: 'Transfers', occurredAt: new Date('2026-03-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  const result = detectRecurring(transactions as any);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'salary');
  assert.equal(result[0].direction, 'credit');
});

test('Test 4 — Detect EMI', () => {
  const transactions = [
    { id: 't1', merchant: 'BAJAJ FINANCE', amountPaise: 850000, direction: 'debit', category: 'EMI & loans', occurredAt: new Date('2026-01-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'BAJAJ FINANCE', amountPaise: 850000, direction: 'debit', category: 'EMI & loans', occurredAt: new Date('2026-02-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't3', merchant: 'BAJAJ FINANCE', amountPaise: 850000, direction: 'debit', category: 'EMI & loans', occurredAt: new Date('2026-03-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  const result = detectRecurring(transactions as any);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'emi');
});

test('Test 5 — Reject too few occurrences', () => {
  const transactions = [
    { id: 't1', merchant: 'SPOTIFY', amountPaise: 12900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-01-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'SPOTIFY', amountPaise: 12900, direction: 'debit', category: 'Entertainment', occurredAt: new Date('2026-02-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  assert.equal(detectRecurring(transactions as any).length, 0);
});

test('Test 6 — Variable amount utility', () => {
  const transactions = [
    { id: 't1', merchant: 'ELECTRICITY BOARD', amountPaise: 100000, direction: 'debit', category: 'Bills', occurredAt: new Date('2026-01-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't2', merchant: 'ELECTRICITY BOARD', amountPaise: 160000, direction: 'debit', category: 'Bills', occurredAt: new Date('2026-02-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
    { id: 't3', merchant: 'ELECTRICITY BOARD', amountPaise: 80000, direction: 'debit', category: 'Bills', occurredAt: new Date('2026-03-01').getTime(), status: 'auto', sourceHash: null, rawBody: null, accountLast4: null, reference: null, confidence: 1, createdAt: 0, updatedAt: 0 },
  ];
  const result = detectRecurring(transactions as any);
  assert.equal(result.length, 1);
  assert.equal(result[0].kind, 'utility');
  assert.equal(result[0].amountVaries, true);
});
