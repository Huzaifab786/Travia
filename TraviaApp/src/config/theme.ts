// Travia Design System — theme.ts
// Dark Navy + Electric Emerald palette (premium, modern, high-contrast)

export const palette = {
  // Core brand — Electric Emerald
  emerald: '#10B981',
  emeraldDark: '#047857',
  emeraldLight: '#A7F3D0',
  emeraldSubtle: '#064E3B', // For subtle dark backgrounds

  // Neutrals — Deep Dark Navy
  navy: '#0B1120',
  navyMid: '#111827',
  navySurface: '#1F2937',
  navyBorder: '#374151',

  // Amber accent
  amber: '#F59E0B',
  amberLight: '#FEF3C7',

  // Semantic
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF9C3',

  white: '#FFFFFF',
  black: '#000000',
};

export type Theme = typeof darkTheme;

export const darkTheme = {
  dark: true,

  // Backgrounds — clear hierarchy
  background: '#0B1120',           // deep navy
  surface: '#111827',              // mid navy
  surfaceElevated: '#1F2937',      // elevated navy
  border: '#374151',

  // Text — high contrast on dark
  textPrimary: '#F8FAFC',          // very bright text
  textSecondary: '#94A3B8',        // slate-400
  textMuted: '#64748B',            // slate-500
  textInverse: '#0B1120',

  // Brand — Electric Emerald
  primary: '#10B981',
  primaryDark: '#047857',
  primaryLight: '#34D399',
  primarySubtle: '#064E3B',        // dark tinted emerald for glow/glass

  // Semantic backgrounds
  danger: '#EF4444',
  dangerBg: '#450A0A',
  success: '#10B981',
  successBg: '#064E3B',
  amber: '#F59E0B',
  amberBg: '#451A03',

  // Tab bar
  tabBarBg: '#0B1120',
  tabBarBorder: '#1F2937',
  tabBarActive: '#10B981',
  tabBarInactive: '#64748B',

  // Card shadow
  shadowColor: '#000000',
};

export const lightTheme: Theme = {
  dark: false,

  // Backgrounds — airy, clean
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  border: '#E2E8F0',

  // Text — strong contrast on light
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // Brand — Electric Emerald (slightly darker for WCAG AA on white)
  primary: '#059669',
  primaryDark: '#047857',
  primaryLight: '#6EE7B7',
  primarySubtle: '#D1FAE5',

  // Semantic backgrounds
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  success: '#059669',
  successBg: '#ECFDF5',
  amber: '#D97706',
  amberBg: '#FEF3C7',

  // Tab bar
  tabBarBg: '#FFFFFF',
  tabBarBorder: '#E2E8F0',
  tabBarActive: '#059669',
  tabBarInactive: '#94A3B8',

  // Card shadow
  shadowColor: '#0F172A',
};

// Import responsive utilities (keep as-is)
import { nf, wp } from "../lib/utils/responsive";

// Typography — unchanged
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

// Spacing scale — unchanged
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

// Border radius — unchanged
export const radius = {
  sm:   wp(8),
  md:   wp(12),
  lg:   wp(16),
  xl:   wp(20),
  '2xl': wp(24),
  full: 999,
};