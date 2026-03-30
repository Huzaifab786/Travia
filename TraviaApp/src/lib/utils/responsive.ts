// Travia — useResponsive.ts
// Universal responsive sizing hook based on device dimensions

import { Dimensions, PixelRatio } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Design baseline: iPhone 14 / Pixel 7 (390 x 844)
const BASE_WIDTH  = 390;
const BASE_HEIGHT = 844;

/**
 * Scale a size relative to screen width.
 * Use for horizontal spacing, font sizes, icon sizes.
 */
export function wp(size: number): number {
  return Math.round((size / BASE_WIDTH) * SCREEN_W);
}

/**
 * Scale a size relative to screen height.
 * Use for vertical spacing, card heights, map proportions.
 */
export function hp(size: number): number {
  return Math.round((size / BASE_HEIGHT) * SCREEN_H);
}

/**
 * Normalize font size across device pixel densities.
 * Keeps text readable on both low-res and high-res screens.
 */
export function nf(size: number): number {
  const scaled = (size / BASE_WIDTH) * SCREEN_W;
  return Math.round(PixelRatio.roundToNearestPixel(scaled));
}

/** Raw screen dimensions for layout calculations */
export const screen = {
  width: SCREEN_W,
  height: SCREEN_H,
  isSmall: SCREEN_H < 700,    // iPhone SE, budget Androids
  isMedium: SCREEN_H >= 700 && SCREEN_H < 900,
  isLarge: SCREEN_H >= 900,   // iPhone Pro Max, large Androids
};
