import type { BoxProps } from '@opentui/react'

// OpenCode-style SplitBorder: only vertical lines, no boxes
// This creates the clean, professional look of OpenCode's pane separators
export const SplitBorder: Pick<BoxProps, 'border' | 'borderStyle' | 'customBorderChars'> = {
  border: ['left'],
  borderStyle: 'single',
  customBorderChars: {
    topLeft: '',
    bottomLeft: '',
    vertical: '┃',
    topRight: '',
    bottomRight: '',
    horizontal: ' ',
    bottomT: '',
    topT: '',
    cross: '',
    leftT: '',
    rightT: '',
  },
}

// Right border variant (for panes on the right side)
export const SplitBorderRight: Pick<BoxProps, 'border' | 'borderStyle' | 'customBorderChars'> = {
  border: ['right'],
  borderStyle: 'single',
  customBorderChars: {
    topLeft: '',
    bottomLeft: '',
    vertical: '┃',
    topRight: '',
    bottomRight: '',
    horizontal: ' ',
    bottomT: '',
    topT: '',
    cross: '',
    leftT: '',
    rightT: '',
  },
}

// No border variant (for panes without borders)
export const NoBorder: Pick<BoxProps, 'border'> = {
  border: false,
}
