// Travia Design System — theme.ts
// Deep Navy + Electric Emerald palette, supports Light & Dark mode

export const palette = {
  // Core brand — slightly brighter for better pop on dark backgrounds
  emerald: '#00D4A0',
  emeraldDark: '#00A87E',
  emeraldLight: '#CCFAEE',
  emeraldSubtle: '#E6FDF5',

  // Neutrals — truer navy with more distinct steps
  navy: '#0C1120',
  navyMid: '#131926',
  navySurface: '#1C2840',
  navyBorder: '#293857',

  // Amber accent (price, ratings)
  amber: '#F59E0B',
  amberLight: '#FEF3C7',

  // Semantic
  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  success: '#10B981',
  successLight: '#ECFDF5',
  warning: '#F59E0B',
  warningLight: '#FFFBEB',

  // Text (absolute)
  white: '#FFFFFF',
  black: '#0C1120',
};

export type Theme = typeof darkTheme;

export const darkTheme = {
  dark: true,

  // Backgrounds — more contrast between steps
  background: '#0C1120',
  surface: '#131926',
  surfaceElevated: '#1C2840',
  border: '#293857',

  // Text — better readability on dark navy
  textPrimary: '#F0F4FF',         // slightly warm white is easier to read
  textSecondary: '#8D9BB5',       // more blue-tinted for harmony
  textMuted: '#5A6A80',           // lighter than before (was too dark)
  textInverse: '#0C1120',

  // Brand — slightly brighter for more pop
  primary: '#00D4A0',
  primaryDark: '#00A87E',
  primaryLight: '#CCFAEE',
  primarySubtle: '#0C2E24',

  // Semantic
  danger: '#EF4444',
  dangerBg: '#2C1A1A',
  success: '#10B981',
  successBg: '#0C2A20',
  amber: '#F59E0B',
  amberBg: '#2A2108',

  // Tab bar
  tabBarBg: '#0C1120',
  tabBarBorder: '#1C2840',
  tabBarActive: '#00D4A0',
  tabBarInactive: '#5A6A80',

  // Card shadow — visible on dark bg
  shadowColor: '#000000',
};

export const lightTheme: Theme = {
  dark: false,

  // Backgrounds
  background: '#F3F6FA',
  surface: '#FFFFFF',
  surfaceElevated: '#EEF2F8',
  border: '#DDE3EE',

  // Text — better contrast on light bg
  textPrimary: '#0C1120',
  textSecondary: '#556070',       // darker than before for better contrast
  textMuted: '#8492A6',
  textInverse: '#FFFFFF',

  // Brand — slightly deeper for WCAG AA on white
  primary: '#009970',
  primaryDark: '#007A58',
  primaryLight: '#CCFAEE',
  primarySubtle: '#E6FDF5',

  // Semantic
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  success: '#059669',
  successBg: '#ECFDF5',
  amber: '#D97706',
  amberBg: '#FEF3C7',

  // Tab bar
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#DDE3EE',
  tabBarActive: '#009970',
  tabBarInactive: '#8492A6',

  // Card shadow
  shadowColor: '#4A5568',
};

import { nf, wp } from "../lib/utils/responsive";

export const typography = {
  hero:         { fontSize: nf(36), fontWeight: '800' as const, letterSpacing: -0.5 },
  h1:           { fontSize: nf(28), fontWeight: '800' as const, letterSpacing: -0.3 },
  h2:           { fontSize: nf(22), fontWeight: '700' as const, letterSpacing: -0.2 },
  h3:           { fontSize: nf(18), fontWeight: '700' as const },
  h4:           { fontSize: nf(16), fontWeight: '600' as const },
  body:         { fontSize: nf(15), fontWeight: '400' as const },
  bodyMedium:   { fontSize: nf(15), fontWeight: '500' as const },
  bodySemiBold: { fontSize: nf(15), fontWeight: '600' as const },
  caption:      { fontSize: nf(13), fontWeight: '400' as const },
  captionMedium:{ fontSize: nf(13), fontWeight: '500' as const },
  label:        { fontSize: nf(11), fontWeight: '700' as const, letterSpacing: 0.6 },
};

// Spacing scale (4px base)
export const spacing = {
  xs:   wp(4),
  sm:   wp(8),
  md:   wp(12),
  lg:   wp(16),
  xl:   wp(20),
  '2xl': wp(24),
  '3xl': wp(32),
  '4xl': wp(40),
  '5xl': wp(56),
};

// Border radius
export const radius = {
  sm:   wp(8),
  md:   wp(12),
  lg:   wp(16),

  xl:   wp(20),
  '2xl': wp(24),
  full: 999,
};

