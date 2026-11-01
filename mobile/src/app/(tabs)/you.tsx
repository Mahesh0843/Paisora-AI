import React, { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  Switch,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import {
  Body,
  Caption,
  Screen,
  ScreenHead,
  SectionTitle,
} from '@/ui/Kit';
import { Icon } from '@/ui/Icon';
import { fonts, usePalette } from '@/ui/theme';
import { useLedger } from '@/state/LedgerProvider';
import { showMessage } from '@/ui/dialog';
import {
  isLockEnabled,
  isBiometricEnabled,
  isBiometricAvailable,
  clearPin,
  enableBiometric,
  disableBiometric,
} from '@/lib/auth';
import { isLlmReady } from '@/lib/providers';
import PinSetupModal from '@/components/PinSetupModal';

export default function You() {
  const p = usePalette();
  const { preferences, senders, setPreference, enableSms, rescanAllSms } = useLedger();
  const [llmReady, setLlmReady] = useState(false);

  async function rescanAll() {
    try {
      const added = await rescanAllSms();
      showMessage(
        'Rescan complete',
        added > 0
          ? `${added} ${added === 1 ? 'entry' : 'entries'} added.`
          : 'No new bank transactions found. Check that your bank sender IDs are correct in the section above.',
      );
    } catch (e) {
      showMessage(
        'Rescan failed',
        e instanceof Error ? e.message : 'Try again.',
      );
    }
  }

  // Refresh LLM readiness whenever the screen mounts / focus returns.
  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      void isLlmReady().then(v => {
        if (mounted) setLlmReady(v);
      });
    };
    refresh();
    // Re-check when the user comes back from /ai-settings
    const interval = setInterval(refresh, 1500);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  async function toggleRead(value: boolean) {
    try {
      if (value) {
        const granted = await enableSms();
        if (!granted) {
          showMessage(
            'Permission needed',
            'SMS reading needs Android READ_SMS permission.',
          );
        }
      } else {
        await setPreference('readSms', false);
      }
    } catch (e) {
      showMessage(
        'Could not change setting',
        e instanceof Error ? e.message : 'Try again.',
      );
    }
  }

  return (
    <Screen>
      <ScreenHead title="Reading rules" />

      <Body muted>
        Paisora AI reads only allowlisted bank senders on Android. Your
        ledger stays on this device until you choose to back it up.
      </Body>

      {/* ─────────── On this phone ─────────── */}
      <View style={{ marginTop: 31, marginBottom: 8 }}>
        <SectionTitle>On this phone</SectionTitle>
      </View>

      {Platform.OS === 'android' ? (
        <Setting
          title="Read bank SMS"
          detail="Look for transactions when the app opens"
          value={preferences.readSms}
          onChange={value => void toggleRead(value)}
        />
      ) : (
        <View style={{ paddingVertical: 15 }}>
          <Body>SMS reading is available on Android builds.</Body>
          <Caption>Manual entries work here too.</Caption>
        </View>
      )}

      <Setting
        title="Auto-add when confident"
        detail="Uncertain reads wait in your inbox"
        value={preferences.autoAdd}
        onChange={value => void setPreference('autoAdd', value)}
      />

      <View
        style={{
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: p.line,
        }}
      >
        <Body>OTP patterns are filtered</Body>
        <Caption>
          Review uncertain messages before keeping them in your ledger.
        </Caption>
      </View>

      {/* ─────────── Bank senders ─────────── */}
      <View
        style={{
          marginTop: 30,
          marginBottom: 9,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}
      >
        <SectionTitle>Bank senders</SectionTitle>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a bank sender"
          onPress={() => router.push('/sender')}
        >
          <Icon name="plus" color={p.ink} size={21} />
        </Pressable>
      </View>

      {senders.map(sender => (
        <Pressable
          key={sender.address}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${sender.label}`}
          onPress={() =>
            router.push({
              pathname: '/sender',
              params: { address: sender.address },
            })
          }
          style={{
            paddingVertical: 13,
            borderBottomWidth: 1,
            borderBottomColor: p.line,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: fonts.bodyMedium, color: p.ink }}>
              {sender.label}
            </Text>
            <Caption>
              {sender.address} · {sender.enabled ? 'Reading' : 'Paused'}
            </Caption>
          </View>
          <Icon name="chevron" color={p.muted} size={17} />
        </Pressable>
      ))}

      {/* ─────────── AI features ─────────── */}
      <View style={{ marginTop: 30, marginBottom: 9 }}>
        <SectionTitle>AI features</SectionTitle>
      </View>

      <Menu
        title="AI provider"
        detail={
          llmReady
            ? 'Connected · tap to change provider or model'
            : 'Choose Gemini, Groq, or OpenRouter and add your API key'
        }
        icon="refresh"
        onPress={() => router.push('/ai-settings')}
      />

      <Menu
        title="Ask about your money"
        detail={
          llmReady
            ? 'Chat with your ledger in plain language'
            : 'Set up AI provider first'
        }
        icon="sms"
        onPress={() => router.push('/copilot')}
      />

      {/* ─────────── Your data ─────────── */}
      <View style={{ marginTop: 32, marginBottom: 9 }}>
        <SectionTitle>Your data</SectionTitle>
      </View>

      <Menu
        title="Paste a bank SMS"
        detail="Parse a message you choose"
        icon="sms"
        onPress={() => router.push('/import')}
      />

      <Menu
        title="Rescan all bank SMS"
        detail="Re-read every message from your bank senders"
        icon="refresh"
        onPress={() => void rescanAll()}
      />

      <Menu
        title="Recurring payments"
        detail="Subscriptions, EMIs, and salary detected from your history"
        icon="refresh"
        onPress={() => router.push('/recurring')}
      />

      <Menu
        title="Encrypted backup"
        detail="Optional · stored on your Render API"
        icon="cloud"
        onPress={() => router.push('/backup')}
      />

      {/* ─────────── Security ─────────── */}
      <View style={{ marginTop: 32, marginBottom: 9 }}>
        <SectionTitle>Security</SectionTitle>
      </View>

      <SecurityRow />

      <View style={{ height: 24 }} />
    </Screen>
  );
}

// ────────────────────────────────────────────────────────────
// Reusable rows
// ────────────────────────────────────────────────────────────

function Setting({
  title,
  detail,
  value,
  onChange,
}: {
  title: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
      }}
    >
      <View style={{ flex: 1 }}>
        <Body>{title}</Body>
        <Caption>{detail}</Caption>
      </View>
      <Switch
        accessibilityLabel={title}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: p.line, true: p.leaf }}
        thumbColor={value ? p.onLeaf : p.muted}
      />
    </View>
  );
}

function SecurityRow() {
  const p = usePalette();
  const [lockOn, setLockOn] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioOn, setBioOn] = useState(false);
  const [modal, setModal] = useState<null | 'set' | 'change' | 'disable'>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    void (async () => {
      const [enabled, available, bio] = await Promise.all([
        isLockEnabled(),
        isBiometricAvailable(),
        isBiometricEnabled(),
      ]);
      setLockOn(enabled);
      setBioAvailable(available);
      setBioOn(bio);
    })();
  }, [refreshKey]);

  const refresh = () => setRefreshKey(k => k + 1);

  async function toggleBio(value: boolean) {
    try {
      if (value) await enableBiometric();
      else await disableBiometric();
      setBioOn(value);
    } catch (e) {
      showMessage(
        'Could not change',
        e instanceof Error ? e.message : 'Try again.',
      );
    }
  }

  async function onModalComplete() {
    if (modal === 'disable') {
      await clearPin();
    }
    setModal(null);
    refresh();
  }

  const modalMode: 'set' | 'change' | 'disable' = modal ?? 'set';

  return (
    <View style={{ gap: 4 }}>
      {!lockOn ? (
        <Pressable
          onPress={() => setModal('set')}
          style={{
            paddingVertical: 14,
            borderBottomWidth: 1,
            borderBottomColor: p.line,
          }}
        >
          <Body>Turn on App Lock</Body>
          <Caption>Require a PIN to open Paisora AI</Caption>
        </Pressable>
      ) : (
        <>
          <Pressable
            onPress={() => setModal('change')}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: p.line,
            }}
          >
            <Body>Change PIN</Body>
          </Pressable>

          {bioAvailable ? (
            <View
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: p.line,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 15,
              }}
            >
              <View style={{ flex: 1 }}>
                <Body>Biometric Unlock</Body>
                <Caption>Use fingerprint or face to unlock</Caption>
              </View>
              <Switch
                accessibilityLabel="Biometric Unlock"
                value={bioOn}
                onValueChange={v => void toggleBio(v)}
                trackColor={{ false: p.line, true: p.leaf }}
                thumbColor={bioOn ? p.onLeaf : p.muted}
              />
            </View>
          ) : null}

          <Pressable
            onPress={() => setModal('disable')}
            style={{
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: p.line,
            }}
          >
            <Text style={{ color: p.debit, fontFamily: fonts.bodyMedium }}>
              Turn off App Lock
            </Text>
          </Pressable>
        </>
      )}

      <PinSetupModal
        visible={modal !== null}
        mode={modalMode}
        onCancel={() => setModal(null)}
        onComplete={onModalComplete}
      />
    </View>
  );
}

function Menu({
  title,
  detail,
  icon,
  onPress,
}: {
  title: string;
  detail: string;
  icon: string;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: p.line,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <Icon name={icon as any} color={p.ink} size={21} />
      <View style={{ flex: 1 }}>
        <Body>{title}</Body>
        <Caption>{detail}</Caption>
      </View>
      <Icon name="chevron" color={p.muted} size={17} />
    </Pressable>
  );
}