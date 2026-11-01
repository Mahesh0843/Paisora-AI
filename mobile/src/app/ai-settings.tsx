import React, { useEffect, useState } from 'react';
import {
  Pressable, ScrollView, Text, TextInput, View,
} from 'react-native';
import { router } from 'expo-router';
import { Screen, ScreenHead, SectionTitle, Body, Caption } from '@/ui/Kit';
import { Icon } from '@/ui/Icon';
import { fonts, usePalette } from '@/ui/theme';
import { showMessage } from '@/ui/dialog';
import {
  PROVIDERS,
  getActiveProvider,
  setActiveProvider,
  getApiKey,
  setApiKey,
  getModel,
  setModel,
  hasKey,
  type ProviderId,
} from '@/lib/providers';
import { testConnection } from '@/lib/llm';

export default function AiSettings() {
  const p = usePalette();
  const [active, setActive] = useState<ProviderId | null>(null);
  const [keys, setKeys] = useState<Record<string, boolean>>({});
  const [draftKeys, setDraftKeys] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    void (async () => {
      const a = await getActiveProvider();
      setActive(a);
      const k: Record<string, boolean> = {};
      const m: Record<string, string> = {};
      for (const prov of PROVIDERS) {
        k[prov.id] = await hasKey(prov.id);
        m[prov.id] = await getModel(prov.id);
      }
      setKeys(k);
      setModels(m);
    })();
  }, []);

  async function pickProvider(id: ProviderId) {
    await setActiveProvider(id);
    setActive(id);
  }

  async function saveKey(id: ProviderId) {
    const value = (draftKeys[id] ?? '').trim();
    if (!value) {
      showMessage('API key required', 'Paste the key from the provider dashboard.');
      return;
    }
    await setApiKey(id, value);
    setKeys(prev => ({ ...prev, [id]: true }));
    setDraftKeys(prev => ({ ...prev, [id]: '' }));
    showMessage('Saved', 'API key stored securely.');
  }

  async function clearKey(id: ProviderId) {
    await setApiKey(id, '');
    setKeys(prev => ({ ...prev, [id]: false }));
  }

  async function changeModel(id: ProviderId, model: string) {
    await setModel(id, model);
    setModels(prev => ({ ...prev, [id]: model }));
  }

  async function runTest() {
    setTesting(true);
    try {
      const res = await testConnection();
      showMessage(res.ok ? 'Success' : 'Failed', res.message);
    } finally {
      setTesting(false);
    }
  }

  return (
    <Screen>
      <ScreenHead title="AI provider" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Body muted>
          Pick a provider, paste your API key. Everything is stored securely
          on this device. The AI only sees the amounts, categories, and
          merchant names — never your raw SMS.
        </Body>

        <View style={{ marginTop: 24, marginBottom: 8 }}>
          <SectionTitle>Provider</SectionTitle>
        </View>
        {PROVIDERS.map(prov => {
          const selected = active === prov.id;
          const configured = keys[prov.id];
          return (
            <Pressable
              key={prov.id}
              onPress={() => void pickProvider(prov.id)}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: p.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 20, height: 20, borderRadius: 10,
                  borderWidth: 2,
                  borderColor: selected ? p.leaf : p.line,
                  backgroundColor: selected ? p.leaf : 'transparent',
                }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>
                  {prov.label}
                </Text>
                <Caption>
                  {configured ? `Key saved · ${models[prov.id]}` : 'Not configured'}
                </Caption>
              </View>
            </Pressable>
          );
        })}

        {active ? (
          <>
            <View style={{ marginTop: 28, marginBottom: 8 }}>
              <SectionTitle>API key</SectionTitle>
            </View>
            {keys[active] ? (
              <View
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: p.line,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Icon name="check" color={p.leaf} size={18} />
                <View style={{ flex: 1 }}>
                  <Body>Key saved</Body>
                  <Caption>
                    {PROVIDERS.find(x => x.id === active)?.helpUrl}
                  </Caption>
                </View>
                <Pressable onPress={() => void clearKey(active)}>
                  <Text style={{ color: p.debit, fontFamily: fonts.bodyMedium }}>
                    Remove
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ paddingVertical: 8 }}>
                <TextInput
                  value={draftKeys[active] ?? ''}
                  onChangeText={t =>
                    setDraftKeys(prev => ({ ...prev, [active]: t }))
                  }
                  placeholder={
                    PROVIDERS.find(x => x.id === active)?.keyPlaceholder
                  }
                  placeholderTextColor={p.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  secureTextEntry
                  style={{
                    borderWidth: 1,
                    borderColor: p.line,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: p.ink,
                    fontFamily: fonts.mono,
                    fontSize: 13,
                  }}
                />
                <View style={{ height: 10 }} />
                <Pressable
                  onPress={() => void saveKey(active)}
                  style={{
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: p.leaf,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: p.onLeaf, fontFamily: fonts.bodyMedium }}>
                    Save key
                  </Text>
                </Pressable>
                <View style={{ height: 6 }} />
                <Caption>
                  Get a key at{' '}
                  {PROVIDERS.find(x => x.id === active)?.helpUrl}
                </Caption>
              </View>
            )}

            <View style={{ marginTop: 28, marginBottom: 8 }}>
              <SectionTitle>Model</SectionTitle>
            </View>
            {PROVIDERS.find(x => x.id === active)?.models.map(m => (
              <Pressable
                key={m}
                onPress={() => void changeModel(active, m)}
                style={{
                  paddingVertical: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: p.line,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 16, height: 16, borderRadius: 8,
                    borderWidth: 2,
                    borderColor: models[active] === m ? p.leaf : p.line,
                    backgroundColor:
                      models[active] === m ? p.leaf : 'transparent',
                  }}
                />
                <Text style={{ fontFamily: fonts.mono, color: p.ink, fontSize: 13 }}>
                  {m}
                </Text>
              </Pressable>
            ))}

            <View style={{ marginTop: 24 }}>
              <Pressable
                onPress={() => void runTest()}
                disabled={testing || !keys[active]}
                style={{
                  paddingVertical: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: p.line,
                  alignItems: 'center',
                  opacity: testing || !keys[active] ? 0.5 : 1,
                }}
              >
                <Text style={{ color: p.ink, fontFamily: fonts.bodyMedium }}>
                  {testing ? 'Testing…' : 'Test connection'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}