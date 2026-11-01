import React, { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { fonts, usePalette } from '@/ui/theme';
import PinPad from './PinPad';
import { setPin, verifyPin } from '@/lib/auth';

type Step = 'current' | 'enter' | 'confirm';
type Mode = 'set' | 'change' | 'disable';

interface Props {
  visible: boolean;
  mode: Mode;
  onCancel: () => void;
  onComplete: () => void;
}

const PIN_LENGTH = 4;

export default function PinSetupModal({ visible, mode, onCancel, onComplete }: Props) {
  const p = usePalette();
  const initialStep: Step = mode === 'set' ? 'enter' : 'current';
  const [step, setStep] = useState<Step>(initialStep);
  const [digits, setDigits] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setStep(mode === 'set' ? 'enter' : 'current');
    setDigits('');
    setFirstPin('');
    setError('');
    setBusy(false);
  };

  const close = () => {
    reset();
    onCancel();
  };

  async function handleComplete(pin: string) {
    setBusy(true);
    setError('');
    try {
      if (step === 'current') {
        const ok = await verifyPin(pin);
        if (!ok) {
          setError('Wrong PIN');
          setDigits('');
          return;
        }
        if (mode === 'disable') {
          onComplete();
          reset();
          return;
        }
        setStep('enter');
        setDigits('');
        return;
      }
      if (step === 'enter') {
        setFirstPin(pin);
        setStep('confirm');
        setDigits('');
        return;
      }
      // confirm
      if (pin !== firstPin) {
        setError('PINs do not match');
        setFirstPin('');
        setStep('enter');
        setDigits('');
        return;
      }
      await setPin(pin);
      onComplete();
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Try again');
      setDigits('');
    } finally {
      setBusy(false);
    }
  }

  function onDigit(d: string) {
    if (busy) return;
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

  const title =
    step === 'current'
      ? 'Enter current PIN'
      : step === 'enter'
      ? mode === 'change'
        ? 'Enter new PIN'
        : 'Create a PIN'
      : 'Confirm PIN';

  const subtitle =
    step === 'enter'
      ? `Choose a ${PIN_LENGTH}-digit PIN`
      : step === 'confirm'
      ? 'Enter the same PIN again'
      : '';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={close}>
      <View
        style={{
          flex: 1,
          backgroundColor: p.bg,
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <Text style={{ fontFamily: fonts.display, fontSize: 24, color: p.ink, textAlign: 'center' }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={{
              fontFamily: fonts.body,
              fontSize: 14,
              color: p.muted,
              marginTop: 8,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </Text>
        ) : null}
        <View style={{ height: 24 }} />
        {error ? (
          <Text style={{ color: p.debit, fontFamily: fonts.bodyMedium, marginBottom: 8 }}>
            {error}
          </Text>
        ) : null}
        <PinPad digits={digits} onDigit={onDigit} onBackspace={onBackspace} pinLength={PIN_LENGTH} />
        <Pressable onPress={close} style={{ marginTop: 24 }}>
          <Text style={{ fontFamily: fonts.bodyMedium, color: p.muted, fontSize: 15 }}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}