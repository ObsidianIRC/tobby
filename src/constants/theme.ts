// OpenCode-inspired theme with rich, vibrant colors
export const THEME = {
  // Base backgrounds - rich gradients
  background: '#0d1117', // Deep blue-black
  backgroundPanel: '#161b22', // Slightly lighter panel
  backgroundElement: '#1c2128', // Elevated elements
  backgroundInput: '#0d1117', // Input area

  // Rich accent backgrounds
  backgroundServer: '#1a1f26', // Server pane
  backgroundChat: '#0d1117', // Chat area
  backgroundMembers: '#1a1f26', // Member list
  backgroundHighlight: '#1f2937', // Highlighted items
  backgroundMention: '#3d1f1f', // Mention background (dark red tint)

  // Text colors
  foreground: '#e6edf3', // Bright white text
  mutedText: '#7d8590', // Muted gray
  dimText: '#484f58', // Very dim

  // Borders - clearly visible with color
  border: '#30363d', // Subtle gray border
  borderActive: '#58a6ff', // Blue active border
  borderFocus: '#58a6ff', // Blue focus border
  borderSubtle: '#21262d', // Very subtle

  // Rich accent colors palette
  accent: '#ff7b72', // Coral red - primary
  accentHover: '#ffa198', // Lighter coral
  accentBlue: '#58a6ff', // Bright blue
  accentPurple: '#bc8cff', // Bright purple
  accentGreen: '#56d364', // Bright green
  accentYellow: '#d29922', // Gold
  accentPink: '#ff9bce', // Pink
  accentCyan: '#76e3ea', // Cyan

  // Status colors - vibrant
  error: '#f85149', // Bright red
  success: '#3fb950', // Bright green
  warning: '#d29922', // Gold/orange
  info: '#58a6ff', // Bright blue

  // UI states
  highlight: '#1f2937',
  highlightBackground: '#2d333b',
  selectedBackground: '#1f6feb22', // Blue tint

  // IRC specific
  mention: '#f85149',
  active: '#ff7b72',
  inactive: '#30363d',
} as const

// IRC-specific semantic colors - vibrant palette
export const COLORS = {
  gray: '#7d8590',
  lightGray: '#e6edf3',
  blue: '#58a6ff',
  cyan: '#76e3ea',
  green: '#56d364',
  yellow: '#d29922',
  orange: '#ff9500',
  red: '#f85149',
  magenta: '#d2a8ff',
  purple: '#bc8cff',
  pink: '#ff9bce',
  white: '#ffffff',
  coral: '#ff7b72',
  lavender: '#c69cff',
  mint: '#7ee787',
  gold: '#f0cf65',
} as const

// Nickname color palette - 16 distinct colors for username variety
export const NICKNAME_COLORS = [
  '#58a6ff', // Blue
  '#3fb950', // Green
  '#d29922', // Gold
  '#f85149', // Red
  '#bc8cff', // Purple
  '#ff9bce', // Pink
  '#76e3ea', // Cyan
  '#ff9500', // Orange
  '#56d364', // Lime
  '#d2a8ff', // Lavender
  '#ffa198', // Coral
  '#7ee787', // Mint
  '#f0cf65', // Light gold
  '#a0d0ff', // Sky blue
  '#ff8f96', // Rose
  '#96d0ff', // Ice blue
] as const
