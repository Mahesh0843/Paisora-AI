import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { fonts, usePalette } from '@/ui/theme';

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
] as const;

export interface PinPadProps {
  digits: string;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  pinLength?: number; // default 6
}

export default function PinPad({
  digits,
  onDigit,
  onBackspace,
  disabled,
  pinLength = 4,
}: PinPadProps) {
  const p = usePalette();
  const filled = digits.length;

  return (
    <View style={{ gap: 8 }}>
      {/* Dots */}
      <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 20 }}>
        {Array.from({ length: pinLength }).map((_, i) => (
          <View
            key={i}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: i < filled ? p.leaf : p.line,
            }}
          />
        ))}
      </View>
      {/* Keypad */}
      {KEY_ROWS.map((row, rIdx) => (
        <View key={rIdx} style={{ flexDirection: 'row', gap: 8, justifyContent: 'center' }}>
          {row.map(key => (
            <Pressable
              key={key || `empty-${rIdx}`}
              onPress={() => {
                if (disabled) return;
                if (key === '⌫') onBackspace();
                else if (key) onDigit(key);
              }}
              disabled={disabled || !key}
              style={{
                width: 72,
                height: 56,
                borderRadius: 14,
                backgroundColor: key ? p.surface : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: key ? 1 : 0,
                borderColor: p.line,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              <Text style={{ fontFamily: fonts.displayMedium, fontSize: 22, color: p.ink }}>
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}