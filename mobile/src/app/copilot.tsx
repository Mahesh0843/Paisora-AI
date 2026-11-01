import React, { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Screen, ScreenHead, Body, Caption } from '@/ui/Kit';
import { Icon } from '@/ui/Icon';
import { fonts, usePalette } from '@/ui/theme';
import { useLedger } from '@/state/LedgerProvider';
import { answerQuestion } from '@/lib/copilot';
import { isLlmReady } from '@/lib/providers';
import { router } from 'expo-router';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'What was my biggest expense?',
  'Food spending this month',
  'Show all UPI transactions',
];

export default function Copilot() {
  const p = usePalette();
  const { transactions } = useLedger();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  React.useEffect(() => {
    void isLlmReady().then(setReady);
  }, []);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user' as const, text: question }].slice(-20));
    setLoading(true);
    try {
      const res = await answerQuestion(question, transactions);
      setMessages(prev =>
        [...prev, { role: 'assistant' as const, text: res.text }].slice(-20),
      );
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    }
  }

  if (ready === false) {
    return (
      <Screen>
        <ScreenHead title="Ask about your money" />
        <View style={{ padding: 16, alignItems: 'center', gap: 12 }}>
          <Icon name="refresh" color={p.muted} size={40} />
          <Body muted>AI features aren't set up yet.</Body>
          <Pressable
            onPress={() => router.push('/ai-settings')}
            style={{
              marginTop: 8,
              paddingVertical: 12,
              paddingHorizontal: 24,
              borderRadius: 10,
              backgroundColor: p.leaf,
            }}
          >
            <Text style={{ color: p.onLeaf, fontFamily: fonts.bodyMedium }}>
              Configure AI
            </Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHead title="Ask about your money" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingVertical: 12, gap: 10 }}
        >
          {messages.length === 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Body muted>Try one of these:</Body>
              {SUGGESTIONS.map(s => (
                <Pressable
                  key={s}
                  onPress={() => void ask(s)}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 14,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: p.line,
                  }}
                >
                  <Text style={{ color: p.ink, fontFamily: fonts.body }}>
                    {s}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : (
            messages.map((m, i) => (
              <View
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '85%',
                  paddingVertical: 10,
                  paddingHorizontal: 14,
                  borderRadius: 16,
                  backgroundColor:
                    m.role === 'user' ? p.leaf : p.surface,
                  borderWidth: m.role === 'user' ? 0 : 1,
                  borderColor: p.line,
                }}
              >
                <Text
                  style={{
                    fontFamily: fonts.body,
                    color: m.role === 'user' ? p.onLeaf : p.ink,
                    fontSize: 15,
                    lineHeight: 21,
                  }}
                >
                  {m.text}
                </Text>
              </View>
            ))
          )}
          {loading ? (
            <View style={{ alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14 }}>
              <Caption>Thinking…</Caption>
            </View>
          ) : null}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            borderTopWidth: 1,
            borderTopColor: p.line,
            paddingTop: 8,
          }}
        >
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask a question…"
            placeholderTextColor={p.muted}
            onSubmitEditing={() => void ask(input)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: p.line,
              borderRadius: 22,
              paddingHorizontal: 14,
              paddingVertical: 10,
              color: p.ink,
              fontFamily: fonts.body,
              fontSize: 15,
            }}
          />
          <Pressable
            onPress={() => void ask(input)}
            disabled={!input.trim() || loading}
            style={{
              width: 42, height: 42, borderRadius: 21,
              backgroundColor: p.leaf,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !input.trim() || loading ? 0.5 : 1,
            }}
          >
            <Icon name="chevron" color={p.onLeaf} size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}