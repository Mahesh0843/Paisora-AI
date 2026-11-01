import React, { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Platform, View } from 'react-native';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LedgerProvider } from '@/state/LedgerProvider';
import { LoadingScreen } from '@/ui/Kit';
import { usePalette } from '@/ui/theme';
import { isLockEnabled } from '@/lib/auth';
import {
  getUnlocked,
  setUnlocked,
  setBackgroundTime,
  getBackgroundTime,
} from '@/lib/session';

const RELOCK_AFTER_MS = 30_000;

export default function RootLayout() {
  const [loaded] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    HankenGrotesk_400Regular,
    HankenGrotesk_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  const p = usePalette();

  // 1. Cold-start gate — redirect to /lock if lock is enabled and not yet unlocked.
  //    Wait for fonts (router not ready before that) and defer one tick so the
  //    root navigator has mounted.
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      void (async () => {
        const enabled = await isLockEnabled();
        if (!enabled) return;
        if (getUnlocked()) return;
        router.replace('/lock' as any);
      })();
    }, 0);
    return () => clearTimeout(t);
  }, [loaded]);

  // 2. AppState listener — record background time, re-lock on return if > 30s.
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      if (state === 'background' || state === 'inactive') {
        setBackgroundTime(Date.now());
        return;
      }
      if (state !== 'active') return;
      void (async () => {
        const enabled = await isLockEnabled();
        if (!enabled) return;
        const elapsed = Date.now() - getBackgroundTime();
        if (elapsed > RELOCK_AFTER_MS) {
          setUnlocked(false);
          router.replace('/lock' as any);
        }
      })();
    });
    return () => sub.remove();
  }, []);

  if (!loaded) return <LoadingScreen />;

  const stack = (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: p.bg },
      }}
    />
  );

  return (
    <SafeAreaProvider>
      <LedgerProvider>
        <StatusBar style={p.bg === '#0A0F1F' ? 'light' : 'dark'} />
        {Platform.OS === 'web' ? (
          <View
            style={{
              flex: 1,
              alignSelf: 'center',
              width: '100%',
              maxWidth: 520,
              backgroundColor: p.bg,
            }}
          >
            {stack}
          </View>
        ) : (
          stack
        )}
      </LedgerProvider>
    </SafeAreaProvider>
  );
}