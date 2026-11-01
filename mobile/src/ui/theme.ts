import { useColorScheme } from 'react-native';

export const palettes = {
  dark: {
    // Surfaces
    bg: '#0A0F1F',            // midnight navy — main canvas
    surface: '#141B2E',       // elevated cards, sheets
    sunk: '#070B17',          // inset areas, code blocks
    line: '#242D48',          // subtle borders, dividers
    strongLine: '#3A4A75',    // emphasized borders

    // Text
    ink: '#E9EDFA',           // primary text
    muted: '#8993B5',         // secondary text

    // Warning / review
    marigold: '#FFB547',      // amber — review badge, warnings
    marigoldSoft: '#2A2416',  // amber tinted background
    onMarigold: '#1A1206',    // text on amber

    // Primary (blue)
    leaf: '#6D9EFF',          // electric blue — main accent, buttons
    onLeaf: '#0A0F1F',        // text on blue

    // Debit (coral)
    debit: '#FF7181',         // coral red — debits, errors
    debitSoft: '#2A1620',     // coral tinted background

    // Credit (teal)
    credit: '#2EE6C5',        // electric teal — credits, success
    creditSoft: '#0F2E2A',    // teal tinted background

    // Misc
    review: '#FFB547',        // same as marigold for consistency
    focus: '#6D9EFF',         // focus ring on inputs
  },
  light: {
    // Surfaces
    bg: '#F6F8FD',            // soft white-blue
    surface: '#FFFFFF',       // clean white card
    sunk: '#EEF1F8',          // inset areas
    line: '#E5E9F2',          // subtle borders
    strongLine: '#B8C1D9',    // emphasized borders

    // Text
    ink: '#0A0F1F',           // deep navy text
    muted: '#5D6788',         // secondary text

    // Warning / review
    marigold: '#C77F00',      // deeper amber for light bg contrast
    marigoldSoft: '#FFF6E0',  // amber tinted background
    onMarigold: '#3A2400',    // text on amber

    // Primary (blue)
    leaf: '#3B72E8',          // electric blue — main accent
    onLeaf: '#FFFFFF',        // text on blue

    // Debit (coral)
    debit: '#DC3545',         // coral red — debits, errors
    debitSoft: '#FDEBED',     // coral tinted background

    // Credit (teal)
    credit: '#00A88C',        // teal — credits, success
    creditSoft: '#E0F5F0',    // teal tinted background

    // Misc
    review: '#C77F00',        // same as marigold for consistency
    focus: '#3B72E8',         // focus ring on inputs
  },
} as const;

export type Palette = typeof palettes.dark | typeof palettes.light;

export function usePalette(): Palette {
  return useColorScheme() === 'light' ? palettes.light : palettes.dark;
}

// ────────────────────────────────────────────────────────────
// Category colors — recalibrated for both light and dark modes.
// These render as small dots/chips, so they need enough saturation
// to pop on both #0A0F1F (dark) and #F6F8FD (light) backgrounds.
// ────────────────────────────────────────────────────────────
export const categoryColors: Record<string, string> = {
  'Food & dining':    '#FF8A5C',  // warm coral-orange
  'Groceries':        '#4ECB71',  // vibrant green
  'Travel':           '#5BA8FF',  // sky blue
  'Bills':            '#A78BFA',  // soft violet
  'Shopping':         '#FF6EB4',  // hot pink
  'Health':           '#2EE6C5',  // teal (matches credit color)
  'Entertainment':    '#FFC940',  // warm yellow
  'Transfers':        '#94A3B8',  // slate grey
  'EMI & loans':      '#FFA53A',  // orange
  'Salary':           '#22C55E',  // strong green
  'Investment':       '#8B5CF6',  // purple
  'Cash withdrawal':  '#F97316',  // deep orange
  'Other':            '#6B7280',  // neutral grey
};

// ────────────────────────────────────────────────────────────
// Fonts — unchanged
// ────────────────────────────────────────────────────────────
export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  displayMedium: 'BricolageGrotesque_600SemiBold',
  body: 'HankenGrotesk_400Regular',
  bodyMedium: 'HankenGrotesk_600SemiBold',
  mono: 'IBMPlexMono_500Medium',
  monoRegular: 'IBMPlexMono_400Regular',
};