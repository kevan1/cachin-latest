import { ReduceMotion } from "react-native-reanimated";

// ============================================================================
// SIZING
// ============================================================================
export const BUBBLE_RADIUS = 200;
export const FONT_SIZE = 28;
export const INTRO_FONT_SIZE = 34;
export const SWIPE_FONT_SIZE = 22;
export const TEXT_GAP = 15;

// ============================================================================
// TEXT CONTENT
// ============================================================================
export const TEXT = "Meet Cachin.";
export const TEXT_2 = "Cash in safely,";
export const INTRO_TEXT_LINE_1 = "A new era of";
export const INTRO_TEXT_LINE_2 = "Payments is here.";
export const INITIAL_TEXT = "Swipe up to enter";
export const ARABIC_TEXT = "Money that moves.";
export const FLIP_WORDS = ["Spend", "Share", "Stack"];

// ============================================================================
// SPRING CONFIGS
// ============================================================================
export const SPRING_SNAP_PROPS = {
  stiffness: 550,
  damping: 140,
  mass: 9,
  overshootClamping: undefined,
  energyThreshold: 6e-9,
  velocity: -300,
  reduceMotion: ReduceMotion.System,
};

export const SPRING_FOLLOW_PROPS = {
  stiffness: 300,
  damping: 30,
  mass: 3,
  reduceMotion: ReduceMotion.System,
};

export const SPRING_TEXT_PROPS = {
  stiffness: 900,
  damping: 120,
  mass: 4,
  overshootClamping: false,
  energyThreshold: 6e-9,
  velocity: 0,
  reduceMotion: ReduceMotion.System,
};
