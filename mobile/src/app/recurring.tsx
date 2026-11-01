import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Screen, ScreenHead, SectionTitle, Body, Caption, EmptyState } from '@/ui/Kit';
import { fonts, usePalette } from '@/ui/theme';
import { useLedger } from '@/state/LedgerProvider';
import { detectRecurring } from '@/lib/recurring';
import { money, dateLabel } from '@/lib/format';

export default function RecurringScreen() {
  const p = usePalette();
  const { transactions } = useLedger();
  const recurring = useMemo(() => detectRecurring(transactions), [transactions]);

  const monthlyDebit = recurring.filter(r => r.direction === 'debit').reduce((sum, r) => {
    if (r.intervalLabel === 'weekly') return sum + r.amountPaise * 4.33;
    if (r.intervalLabel === 'semi-monthly') return sum + r.amountPaise * 2;
    if (r.intervalLabel === 'monthly') return sum + r.amountPaise;
    if (r.intervalLabel === 'quarterly') return sum + r.amountPaise / 3;
    if (r.intervalLabel === 'annual') return sum + r.amountPaise / 12;
    return sum + r.amountPaise;
  }, 0);

  const monthlyCredit = recurring.filter(r => r.direction === 'credit').reduce((sum, r) => {
    if (r.intervalLabel === 'weekly') return sum + r.amountPaise * 4.33;
    if (r.intervalLabel === 'semi-monthly') return sum + r.amountPaise * 2;
    if (r.intervalLabel === 'monthly') return sum + r.amountPaise;
    if (r.intervalLabel === 'quarterly') return sum + r.amountPaise / 3;
    if (r.intervalLabel === 'annual') return sum + r.amountPaise / 12;
    return sum + r.amountPaise;
  }, 0);

  const sections: Record<string, typeof recurring> = {
    'Subscriptions': recurring.filter(r => r.kind === 'subscription' || r.kind === 'sip'),
    'Bills & utilities': recurring.filter(r => r.kind === 'utility' || r.kind === 'rent'),
    'Loans': recurring.filter(r => r.kind === 'emi'),
    'Income': recurring.filter(r => r.kind === 'salary'),
    'Other': recurring.filter(r => r.kind === 'other'),
  };

  return <Screen>
    <ScreenHead title="Recurring" />
    {recurring.length === 0 ? <EmptyState title="No patterns yet" detail="Keep using the app for 2–3 months and we'll start spotting patterns." /> : <>
      <View style={{ backgroundColor: p.leaf, borderRadius: 20, padding: 16, marginTop: 8, marginBottom: 20 }}>
        <Text style={{ fontFamily: fonts.bodyMedium, fontSize: 12, color: p.onLeaf }}>{recurring.length} recurring · {money(Math.round(monthlyDebit))}/month</Text>
        {monthlyCredit > 0 ? <Text style={{ fontFamily: fonts.body, fontSize: 12, color: p.onLeaf, marginTop: 4 }}>+ {money(Math.round(monthlyCredit))}/month in</Text> : null}
      </View>
      {Object.entries(sections).map(([label, items]) => items.length > 0 ? <View key={label} style={{ marginTop: 16 }}>
        <SectionTitle>{label}</SectionTitle>
        {items.map(item => <Pressable key={item.id} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: p.line }}>
          <View>
            <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>{item.merchant}</Text>
            <Caption>{money(item.amountPaise)} · {item.intervalLabel}</Caption>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Caption>Next: {dateLabel(item.nextExpected)}</Caption>
            {item.amountVaries ? <Caption style={{ color: p.review }}>varies</Caption> : null}
          </View>
        </Pressable>)}
      </View> : null)}
    </>}
  </Screen>;
}
