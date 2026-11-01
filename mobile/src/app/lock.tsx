import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/ui/Icon';
import { fonts, usePalette } from '@/ui/theme';
import {
  verifyPin,
  getLockoutRemaining,
  isBiometricEnabled,
  authenticateBiometric,
} from '@/lib/auth';
import PinPad from '@/components/PinPad';
import { setUnlocked } from '@/lib/session';

const PIN_LENGTH = 4;

export default function LockScreen() {
  const p = usePalette();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [bioEnabled, setBioEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bioPromptedRef = useRef(false);

  function goHome() {
    // Prefer the root; falls back to the explicit tabs index.
    // Expo Router resolves '/' to the first available tab.
    try {
      router.replace('/' as any);
    } catch {
      router.replace('/(tabs)' as any);
    }
  }
  // Auto-prompt biometric once
  useEffect(() => {
    let mounted = true;
    void (async () => {
      const enabled = await isBiometricEnabled();
      if (!mounted) return;
      setBioEnabled(enabled);
      if (enabled && !bioPromptedRef.current) {
        bioPromptedRef.current = true;
        setTimeout(async () => {
          if (!mounted) return;
          const ok = await authenticateBiometric();
          if (ok && mounted) {
            setUnlocked(true);
            goHome();
          }
        }, 350);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Lockout countdown
  useEffect(() => {
    const tick = async () => {
      const rem = await getLockoutRemaining();
      setCountdown(Math.max(0, Math.ceil(rem / 1000)));
    };
    void tick();
    timerRef.current = setInterval(tick, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleComplete(pin: string) {
    setBusy(true);
    try {
      const ok = await verifyPin(pin);
      if (ok) {
        setUnlocked(true);
        goHome();
        return;
      }
      setDigits('');
      const rem = await getLockoutRemaining();
      setError(rem > 0 ? 'Too many attempts' : 'Wrong PIN');
    } finally {
      setBusy(false);
    }
  }

  function onDigit(d: string) {
    if (busy || countdown > 0) return;
    setError('');
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + d;
    setDigits(next);
    if (next.length === PIN_LENGTH) {
      void handleComplete(next);
    }
  }

  function onBackspace() {
    if (busy) return;
    setDigits(prev => prev.slice(0, -1));
    setError('');
  }

  async function biometricPress() {
    const ok = await authenticateBiometric();
    if (ok) {
      setUnlocked(true);
      goHome();
    }
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: p.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <Icon name="lock" size={48} color={p.ink} />
      <Text
        style={{
          fontFamily: fonts.display,
          fontSize: 28,
          color: p.ink,
          marginTop: 16,
          textAlign: 'center',
        }}
      >
        Enter your PIN
      </Text>
      <View style={{ height: 20 }} />
      {error ? (
        <Text style={{ color: p.debit, fontFamily: fonts.bodyMedium, marginBottom: 8 }}>{error}</Text>
      ) : null}
      {countdown > 0 ? (
        <Text style={{ color: p.muted, fontFamily: fonts.bodyMedium, marginBottom: 8 }}>
          Try again in {countdown}s
        </Text>
      ) : null}
      <PinPad
        digits={digits}
        onDigit={onDigit}
        onBackspace={onBackspace}
        pinLength={PIN_LENGTH}
        disabled={busy || countdown > 0}
      />
      {bioEnabled ? (
        <Pressable onPress={biometricPress} style={{ marginTop: 20 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, color: p.focus, fontSize: 15 }}>
            Use biometric
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}