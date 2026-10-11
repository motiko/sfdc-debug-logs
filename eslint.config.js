// ESLint 9 flat config for the whole repository. Run it from react/
// (`npm run lint`), which holds the lint dependencies; they are loaded from
// react/node_modules because the repository root has no package.json.
import { createRequire } from 'node:module'

const require = createRequire(new URL('./react/package.json', import.meta.url))
const js = require('@eslint/js')
const globals = require('globals')
const react = require('eslint-plugin-react')
const reactHooks = require('eslint-plugin-react-hooks')

export default [
  {
    ignores: [
      '**/node_modules/',
      'chrome/app/js/build/',
      '.chrome-test/',
      '.claude/',
      'e2e/artifacts/',
      'react/mocks/'
    ]
  },

  js.configs.recommended,

  {
    rules: {
      // Unused function arguments are common in callbacks and documentation.
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }]
    }
  },

  // React app: JSX in .js files, React 16 class components.
  {
    files: ['react/src/**/*.js'],
    ...react.configs.flat.recommended,
    languageOptions: {
      ...react.configs.flat.recommended.languageOptions,
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser, ...globals.webextensions }
    },
    settings: { react: { version: '16.14' } }
  },
  {
    files: ['react/src/**/*.js'],
    ...react.configs.flat['jsx-runtime']
  },
  {
    files: ['react/src/**/*.js'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The app predates prop-types discipline; types come from TypeScript.
      'react/prop-types': 'off'
    }
  },

  // Unit tests run in Node under Vitest.
  {
    files: ['react/src/**/*.test.js'],
    languageOptions: { globals: { ...globals.node } }
  },

  // Node tooling.
  {
    files: [
      'e2e/**/*.{js,mjs}',
      'scripts/**/*.{js,mjs}',
      'eslint.config.js',
      'react/vite.config.mjs',
      'react/build.mjs'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  // e2e callbacks passed to evaluate() run in pages or in the extension's
  // service worker (getSessionForUrl is exposed by extension/background.ts).
  {
    files: ['e2e/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        getSessionForUrl: 'readonly'
      }
    }
  }
]
