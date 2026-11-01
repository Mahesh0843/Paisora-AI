import { PermissionsAndroid, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import { parseBankSms } from './parser';
import type { SenderRule, Transaction } from './model';

export function canReadSms(): boolean { return Platform.OS === 'android'; }

export async function requestSmsPermission(): Promise<boolean> {
  if (!canReadSms()) return false;
  return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read bank transaction SMS',
    message: 'Paisora AI reads messages only from the bank senders you allow. OTPs and personal chats are not added to your ledger.',
    buttonPositive: 'Allow', buttonNegative: 'Not now',
  })) === PermissionsAndroid.RESULTS.GRANTED;
}

export interface ScanResult {
  transactions: Transaction[];
  totalMessages: number;
  parsedOk: number;
  rejected: number;
}

export async function readBankSms(senders: SenderRule[], since: number, autoAdd: boolean): Promise<ScanResult> {
  if (!canReadSms()) return { transactions: [], totalMessages: 0, parsedOk: 0, rejected: 0 };
  const allowed = senders.filter(sender => sender.enabled).map(sender => sender.address);
  console.log('[scan] allowed senders:', allowed);
  console.log('[scan] since:', since === 0 ? 'beginning of time' : new Date(since).toISOString());
  if (!allowed.length) return { transactions: [], totalMessages: 0, parsedOk: 0, rejected: 0 };
  const native = (await import('../../modules/kharcha-sms/src/KharchaSmsModule')).default;
  const messages = await native.listMessages(allowed, since);
  console.log('[scan] native returned:', messages.length);
  if (messages.length > 0) {
    console.log('[scan] first sender:', messages[0].sender);
    console.log('[scan] first body:', messages[0].body.slice(0, 80));
  }
  const result: Transaction[] = [];
  let parsedOk = 0;
  for (const sms of messages) {
    const parsed = parseBankSms(sms.body);
    if (!parsed) continue;
    parsedOk++;
    const sourceHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${sms.sender}\n${sms.receivedAt}\n${sms.body}`,
    );
    const now = Date.now();
    result.push({
      id: Crypto.randomUUID(), sourceHash, sender: sms.sender, rawBody: sms.body,
      occurredAt: sms.receivedAt, merchant: parsed.merchant, amountPaise: parsed.amountPaise,
      direction: parsed.direction, category: parsed.category,
      status: autoAdd && parsed.confidence >= 0.9 ? 'auto' : 'review',
      accountLast4: parsed.accountLast4, reference: parsed.reference,
      confidence: parsed.confidence, createdAt: now, updatedAt: now,
    });
  }
  console.log('[scan] parsed OK:', parsedOk, 'of', messages.length);
  return { transactions: result, totalMessages: messages.length, parsedOk, rejected: messages.length - parsedOk };
}
