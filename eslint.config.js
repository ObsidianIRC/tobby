import js from '@eslint/js'
import typescript from '@typescript-eslint/eslint-plugin'
import typescriptParser from '@typescript-eslint/parser'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: ['ObsidianIRC/**', 'dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        globalThis: 'readonly',
        crypto: 'readonly',
        debugLog: 'readonly',
        URL: 'readonly',
        React: 'readonly',
        Timer: 'readonly',
        require: 'readonly',
        Bun: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      react: react,
      'react-hooks': reactHooks,
    },
    rules: {
      ...typescript.configs.recommended.rules,
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // @opentui uses custom JSX properties (fg, bg, flexDirection, etc.)
      'react/no-unknown-property': [
        'error',
        {
          ignore: [
            'fg',
            'bg',
            'attributes',
            'flexDirection',
            'flexGrow',
            'flexShrink',
            'backgroundColor',
            'focusedBackgroundColor',
            'borderColor',
            'borderStyle',
            'customBorderChars',
            'paddingLeft',
            'paddingRight',
            'paddingTop',
            'paddingBottom',
            'marginLeft',
            'marginRight',
            'marginTop',
            'marginBottom',
            'gap',
            'rowGap',
            'columnGap',
            'justifyContent',
            'alignItems',
            'alignSelf',
            'position',
            'left',
            'right',
            'top',
            'bottom',
            'focused',
            'stickyScroll',
            'stickyStart',
            'scrollAcceleration',
            'titleAlignment',
            'onContentChange',
            'onInput',
            'onSubmit',
            'keyBindings',
            'keyAliasMap',
          ],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
  prettier,
]
