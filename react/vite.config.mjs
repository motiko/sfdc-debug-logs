import { defineConfig, transformWithOxc } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// The sources keep JSX in plain .js files, which Vite only parses as JS.
// Compile their JSX first so the rest of the pipeline sees plain JS.
const jsxInJs = {
  name: 'jsx-in-js',
  enforce: 'pre',
  async transform(code, id) {
    if (!/\/src\/.*\.js$/.test(id) || id.includes('/node_modules/')) return
    const result = await transformWithOxc(code, id, {
      lang: 'jsx',
      jsx: { runtime: 'automatic' }
    })
    return { code: result.code, map: result.map }
  }
}

// Every script of the extension, built into chrome/app/js/build/<name>.js.
// Each one is a single self-contained classic IIFE: content scripts can't be
// ES modules, and Rolldown's IIFE output takes one input per build, so
// build.mjs runs one build per entry. No inline scripts, no eval, no dynamic
// imports, so they run under the extension pages' CSP ("script-src 'self'").
export const entries = {
  // Full-page log viewer (html/app.html), plus app.css.
  app: 'src/app.js',
  // Service worker (manifest.json background.service_worker).
  background: 'src/extension/background.ts',
  // Content scripts (manifest.json content_scripts).
  shortcuts: 'src/extension/shortcuts.ts',
  'debug-log-page': 'src/extension/debug-log-page.ts',
  'debug-log-list': 'src/extension/debug-log-list.ts',
  'class-page': 'src/extension/class-page.ts',
  // Options page (html/options.html).
  options: 'src/extension/options.js'
}

export function entryConfig(name) {
  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    plugins: [jsxInJs, react()],
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
      // Some CommonJS dependencies (jss) expect browserify's `global`.
      global: 'globalThis'
    },
    build: {
      outDir: '../chrome/app/js/build',
      // Several builds share the directory, which also holds a committed
      // .gitignore; each build only replaces its own files.
      emptyOutDir: false,
      target: 'chrome120',
      cssCodeSplit: false,
      modulePreload: false,
      sourcemap: false,
      chunkSizeWarningLimit: 2000,
      rolldownOptions: {
        input: entries[name],
        output: {
          format: 'iife',
          entryFileNames: `${name}.js`,
          assetFileNames: assetInfo =>
            assetInfo.names.some(n => n.endsWith('.css'))
              ? `${name}.css`
              : '[name][extname]'
        }
      }
    }
  }
}

// `vite build` alone builds only the app; `npm run build` (build.mjs) builds
// every entry.
export default defineConfig({
  ...entryConfig('app'),
  // Unit tests (npm test): pure logic only, no DOM.
  test: {
    include: ['src/**/*.test.{js,ts}'],
    environment: 'node',
    // Let tests import chrome/app/css/*.css?raw (themes.test.ts,
    // ad-blocker-names.test.ts); Vitest otherwise replaces CSS with an empty
    // module.
    css: { include: [/chrome\/app\/css\//] }
  }
})
