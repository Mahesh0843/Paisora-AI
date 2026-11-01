import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  Action,
  Body,
  Caption,
  EmptyState,
  Screen,
  ScreenHead,
  SectionTitle,
  SummarySlip,
  TransactionRow,
} from '@/ui/Kit';
import { Icon } from '@/ui/Icon';
import { fonts, usePalette } from '@/ui/theme';
import { detectRecurring } from '@/lib/recurring';
import { useLedger } from '@/state/LedgerProvider';
import { monthLabel, startOfMonth, money } from '@/lib/format';
import { useNow } from '@/lib/useNow';
import { showMessage } from '@/ui/dialog';
import { isLlmReady } from '@/lib/providers';

export default function Home() {
  const p = usePalette();
  const now = useNow();
  const { transactions, budgets, preferences, scan, busy, error, clearError } =
    useLedger();
  const start = startOfMonth(now);
  const current = transactions.filter(
    t => t.occurredAt >= start && t.status !== 'ignored',
  );
  const spent = current
    .filter(t => t.direction === 'debit')
    .reduce((sum, t) => sum + t.amountPaise, 0);
  const received = current
    .filter(t => t.direction === 'credit')
    .reduce((sum, t) => sum + t.amountPaise, 0);
  const budget = budgets.reduce((sum, item) => sum + item.amountPaise, 0);
  const review = transactions.filter(t => t.status === 'review').length;
  const recurring = React.useMemo(
    () => detectRecurring(transactions),
    [transactions],
  );

  // ─── AI readiness (refreshes when returning from /ai-settings) ───
  const [llmReady, setLlmReady] = React.useState(false);
  React.useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void isLlmReady().then(v => {
        if (mounted) setLlmReady(v);
      });
    };
    refresh();
    const interval = setInterval(refresh, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function readNow() {
    try {
      const r = await scan();
      let msg = '';
      if (r.totalMessages === 0) {
        msg =
          'No bank SMS found in your inbox. Open You → Bank senders ' +
          'and add the correct sender ID for your bank.';
      } else if (r.parsedOk === 0) {
        msg =
          `Read ${r.totalMessages} messages but none matched a bank ` +
          'transaction format.';
      } else if (r.added === 0) {
        msg = r.totalMessages === 0
          ? 'No new bank messages since your last check.'
          : `${r.totalMessages} new messages, all already in your ledger.`;
      } else {
        msg =
          `Added ${r.added} new ${r.added === 1 ? 'entry' : 'entries'} ` +
          `from ${r.totalMessages} messages.`;
      }
      showMessage('SMS checked', msg);
    } catch (e) {
      showMessage(
        'Could not read SMS',
        e instanceof Error ? e.message : 'Try again.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHead
        title={`${monthLabel(now)}, so far`}
        action={{
          icon: 'plus',
          label: 'Add a transaction',
          onPress: () => router.push('/manual'),
        }}
      />

      <SummarySlip
        spent={spent}
        received={received}
        budget={budget}
        lastScanAt={preferences.lastScanAt}
      />

      {error ? (
        <Pressable
          onPress={clearError}
          style={{
            marginTop: 17,
            padding: 12,
            backgroundColor: p.debitSoft,
            borderRadius: 10,
          }}
        >
          <Body>{error}  ×</Body>
        </Pressable>
      ) : null}

      {review ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(tabs)/inbox')}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            backgroundColor: p.marigoldSoft,
            borderRadius: 12,
            padding: 15,
            marginTop: 19,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>
            {review} {review === 1 ? 'entry needs' : 'entries need'} your eye
          </Text>
          <Text style={{ color: p.review }}>Review ›</Text>
        </Pressable>
      ) : null}

      {/* ─────────── AI Copilot card ─────────── */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask about your spending"
        onPress={() => router.push('/copilot')}
        style={{
          marginTop: 19,
          padding: 14,
          backgroundColor: p.surface,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: p.line,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Icon
          name={llmReady ? 'refresh' : 'sms'}
          color={llmReady ? p.leaf : p.muted}
          size={22}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>
            {llmReady ? 'Ask about your spending' : 'Set up AI assistant'}
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              color: p.muted,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            {llmReady
              ? 'Chat with your ledger in plain language'
              : 'Add a provider key to enable AI answers'}
          </Text>
        </View>
        <Icon name="chevron" color={p.muted} size={17} />
      </Pressable>

      {/* ─────────── Latest transactions ─────────── */}
      <View
        style={{
          marginTop: 32,
          marginBottom: 13,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <SectionTitle>Latest</SectionTitle>
        <Caption>{current.length} this month</Caption>
      </View>

      {current.length ? (
        current
          .slice(0, 8)
          .map(t => <TransactionRow key={t.id} transaction={t} />)
      ) : (
        <EmptyState
          title="A clean page, for now"
          detail="Add your first expense or let Paisora AI read bank messages on this phone."
          action={
            <Action
              compact
              title="Add an expense"
              icon="plus"
              onPress={() => router.push('/manual')}
            />
          }
        />
      )}

      {/* ─────────── Recurring card ─────────── */}
      {recurring.length > 0 ? (
        <Pressable
          onPress={() => router.push('/recurring')}
          style={{
            marginTop: 19,
            padding: 14,
            backgroundColor: p.surface,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: p.line,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>
            {recurring.length} recurring payments ·{' '}
            {money(
              recurring
                .filter(r => r.direction === 'debit')
                .reduce((sum, r) => {
                  if (r.intervalLabel === 'weekly')
                    return sum + r.amountPaise * 4.33;
                  if (r.intervalLabel === 'semi-monthly')
                    return sum + r.amountPaise * 2;
                  if (r.intervalLabel === 'monthly') return sum + r.amountPaise;
                  if (r.intervalLabel === 'quarterly')
                    return sum + r.amountPaise / 3;
                  if (r.intervalLabel === 'annual')
                    return sum + r.amountPaise / 12;
                  return sum + r.amountPaise;
                }, 0),
            )}
            /month
          </Text>
          <Text
            style={{
              fontFamily: fonts.body,
              color: p.muted,
              fontSize: 12,
              marginTop: 4,
            }}
          >
            Tap to view →
          </Text>
        </Pressable>
      ) : null}

      {/* ─────────── Actions ─────────── */}
      <View style={{ marginTop: 23, gap: 10 }}>
        {preferences.readSms ? (
          <Action
            title={busy ? 'Reading messages…' : 'Read new bank SMS'}
            icon="refresh"
            variant="secondary"
            disabled={busy}
            onPress={() => void readNow()}
          />
        ) : null}
        <Pressable
          onPress={() => router.push('/(tabs)/budgets')}
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: 12,
          }}
        >
          <Body muted>Monthly budgets</Body>
          <Text style={{ fontFamily: fonts.mono, color: p.ink }}>
            {budget ? money(budget) : 'Set up ›'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}