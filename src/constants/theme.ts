// OpenCode-inspired theme with subtle, professional colors
export const THEME = {
  // Base backgrounds - step-based grays from OpenCode
  background: '#0a0a0a', // darkStep1 - deepest background
  backgroundPanel: '#141414', // darkStep2 - panel backgrounds
  backgroundElement: '#1e1e1e', // darkStep3 - elevated elements

  // Text colors
  foreground: '#eeeeee', // darkStep12 - primary text
  mutedText: '#808080', // darkStep11 - secondary text

  // Borders - very subtle
  border: '#484848', // darkStep7 - subtle borders
  borderActive: '#606060', // darkStep8 - active borders
  borderSubtle: '#3c3c3c', // darkStep6 - barely visible borders

  // Accent colors - soft and desaturated like OpenCode
  accent: '#fab283', // soft peach - primary accent
  accentHover: '#ffc09f', // slightly lighter peach
  secondary: '#5c9cf5', // desaturated blue
  tertiary: '#9d7cd8', // soft purple

  // Status colors - IRC specific but using OpenCode palette
  error: '#e06c75', // soft red
  success: '#7fd88f', // soft green
  warning: '#f5a742', // soft orange
  info: '#56b6c2', // soft cyan

  // UI states
  highlight: '#1e1e1e', // darkStep3
  highlightBackground: '#282828', // darkStep4
  selectedBackground: '#323232', // darkStep5

  // IRC specific
  mention: '#e06c75', // soft red for mentions
  active: '#fab283', // soft peach for active items
  inactive: '#3c3c3c', // darkStep6 for inactive
} as const

// IRC-specific semantic colors (using OpenCode palette)
export const COLORS = {
  gray: '#808080', // darkStep11
  lightGray: '#eeeeee', // darkStep12
  blue: '#5c9cf5', // desaturated blue
  cyan: '#56b6c2', // soft cyan
  green: '#7fd88f', // soft green
  yellow: '#e5c07b', // soft yellow
  orange: '#f5a742', // soft orange
  red: '#e06c75', // soft red
  magenta: '#9d7cd8', // soft purple
  white: '#eeeeee', // darkStep12
  peach: '#fab283', // soft peach (OpenCode primary)
} as const
