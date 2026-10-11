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
      'chrome/app/js/lib/',
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
      'react/vite.config.mjs'
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  // e2e callbacks passed to evaluate() run in pages or in the extension's
  // service worker (getSession is a background.js function).
  {
    files: ['e2e/**/*.{js,mjs}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
        getSession: 'readonly'
      }
    }
  },

  // Extension scripts: classic scripts that share top-level names with the
  // other files loaded before them (manifest.json content_scripts order,
  // options.html script order). Declared here instead of refactored into
  // modules for now.
  {
    files: ['chrome/app/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.webextensions }
    },
    rules: {
      // Top-level functions are called from other files or from the page.
      'no-unused-vars': [
        'error',
        { vars: 'local', args: 'none', caughtErrors: 'none' }
      ],
      // Legacy regexes escape more than needed; harmless.
      'no-useless-escape': 'off'
    }
  },
  {
    // Content scripts on Salesforce pages. Every page also gets the
    // "all Salesforce pages" group (default_shortcuts.js, Mousetrap, utils.js,
    // shortcuts.js at document_end), and content scripts of one extension
    // share a global scope, so the later scripts use these names.
    files: ['chrome/app/js/**/*.js'],
    ignores: [
      'chrome/app/js/background.js',
      'chrome/app/js/options.js',
      'chrome/app/js/default_shortcuts.js',
      'chrome/app/js/utils.js'
    ],
    languageOptions: {
      globals: {
        default_shortcuts: 'readonly',
        Mousetrap: 'readonly',
        API_PATH: 'readonly',
        ASYNC_API_PATH: 'readonly',
        getSession: 'readonly',
        getToken: 'readonly',
        sfRequest: 'readonly',
        parseDiscoCookie: 'readonly',
        getUserId: 'readonly',
        logEvent: 'readonly'
      }
    }
  },
  {
    // Loaded after the vendored js-beautify.
    files: ['chrome/app/js/sfdc.debug.js'],
    languageOptions: {
      globals: { js_beautify: 'readonly', html_beautify: 'readonly' }
    }
  },
  {
    // options.html loads browser-polyfill and default_shortcuts.js first.
    files: ['chrome/app/js/options.js'],
    languageOptions: {
      globals: { default_shortcuts: 'readonly' }
    }
  }
]
