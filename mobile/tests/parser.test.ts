import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBankSms } from '../src/lib/parser';

// ────────────────────────────────────────────────────────────
// HDFC card UPI — "Txn" format
// ────────────────────────────────────────────────────────────
test('Test 1 — HDFC UPI spend (real format, no "debit" keyword)', () => {
  const result = parseBankSms(
    'Txn Rs.40.00\nOn HDFC Bank Card 7732\nAt q157305995@ybl\nby UPI 130717895664\nOn 04-10\nNot You?',
  );
  assert.equal(result?.direction, 'debit');
  assert.equal(result?.amountPaise, 4000);
  assert.equal(result?.accountLast4, '7732');
});

// ────────────────────────────────────────────────────────────
// HDFC card UPI — "Txn" format with a real merchant VPA
// ────────────────────────────────────────────────────────────
test('Test 1b — HDFC Txn with merchant name and reference', () => {
  const result = parseBankSms(
    'Txn Rs.58.00\nOn HDFC Bank Card 7732\nAt vishalmegamartpl@ybl\nby UPI 664478913225\nOn 05-10',
  );
  assert.equal(result?.direction, 'debit');
  assert.equal(result?.amountPaise, 5800);
  assert.equal(result?.accountLast4, '7732');
  assert.equal(result?.reference, '664478913225');
  assert.ok(result?.merchant.includes('Vishalmegamartpl'));
  assert.ok(!result?.merchant.includes('@'));
  assert.equal(result?.category, 'Groceries');
});

// ────────────────────────────────────────────────────────────
// HDFC card UPI — "Sent" format
// ────────────────────────────────────────────────────────────
test('Test 2 — HDFC UPI sent (real format, "Sent" prefix)', () => {
  const result = parseBankSms(
    'Sent Rs.1.00\nFrom HDFC Bank A/C *2944\nTo Singuluri Mahesh Chandra\nOn 04/10/26\nRef 130731690896',
  );
  assert.equal(result?.direction, 'debit');
  assert.equal(result?.amountPaise, 100);
  assert.equal(result?.accountLast4, '2944');
  assert.equal(result?.reference, '130731690896');
});

// ────────────────────────────────────────────────────────────
// Explicit direction keywords
// ────────────────────────────────────────────────────────────
test('Test 3 — Explicit debit', () => {
  const result = parseBankSms('Rs.500 debited from A/c XX1234 at ZOMATO on 04-10-2026');
  assert.equal(result?.direction, 'debit');
  assert.equal(result?.amountPaise, 50000);
});

test('Test 4 — Explicit credit', () => {
  const result = parseBankSms('Rs.5000 credited to A/c XX5678 on 04-10-2026');
  assert.equal(result?.direction, 'credit');
  assert.equal(result?.amountPaise, 500000);
});

test('Test 5 — Refund (credit-like term)', () => {
  const result = parseBankSms('Refund of Rs.250 to A/c XX1234');
  assert.equal(result?.direction, 'credit');
  assert.equal(result?.amountPaise, 25000);
});

// ────────────────────────────────────────────────────────────
// Ambiguous messages are REJECTED (safe default)
// ────────────────────────────────────────────────────────────
test('Test 6 — Ambiguous message with no direction keyword is rejected', () => {
  const result = parseBankSms('Rs.100 at TEA STALL on 04-10-2026');
  assert.equal(result, null);
});

test('Test 6b — Balance notification is rejected', () => {
  const result = parseBankSms('Your account balance is Rs.5000');
  assert.equal(result, null);
});

// ────────────────────────────────────────────────────────────
// Rejections
// ────────────────────────────────────────────────────────────
test('Test 7 — OTP message is rejected', () => {
  const result = parseBankSms('OTP 123456 for HDFC Bank login');
  assert.equal(result, null);
});

test('Test 8 — Promo message is rejected', () => {
  const result = parseBankSms('Use code SAVE20 for 20% cashback on Amazon');
  assert.equal(result, null);
});