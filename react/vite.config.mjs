import { defineConfig, transformWithOxc } from 'vite'
import react from '@vitejs/plugin-react'

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

// Builds the full-page log viewer (chrome/app/html/app.html) into
// chrome/app/js/build/. The output is a single classic IIFE script (app.js)
// plus a stylesheet (app.css): no inline scripts, no eval, no dynamic imports,
// so it runs under the extension pages' CSP ("script-src 'self'").
export default defineConfig({
  plugins: [jsxInJs, react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    // Some CommonJS dependencies (jss) expect browserify's `global`.
    global: 'globalThis'
  },
  build: {
    outDir: '../chrome/app/js/build',
    // The directory holds a committed .gitignore; only replace our own files.
    emptyOutDir: false,
    target: 'chrome120',
    cssCodeSplit: false,
    modulePreload: false,
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rolldownOptions: {
      input: 'src/app.js',
      output: {
        format: 'iife',
        entryFileNames: 'app.js',
        assetFileNames: assetInfo =>
          assetInfo.names.some(n => n.endsWith('.css'))
            ? 'app.css'
            : '[name][extname]'
      }
    }
  }
})
