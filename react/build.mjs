// Builds every extension script (see `entries` in vite.config.mjs) into
// chrome/app/js/build/, one Vite build per entry.
//
//   node build.mjs           production build (npm run build)
//   node build.mjs --watch   rebuild each entry on save (npm run dev)
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { build } from 'vite'
import { entries, entryConfig } from './vite.config.mjs'

const watch = process.argv.includes('--watch')
const app = join(import.meta.dirname, '../chrome/app')
const outDir = join(app, 'js/build')

// Start clean so no stale script ends up in the release zip; keep the
// committed .gitignore.
for (const file of readdirSync(outDir)) {
  if (file !== '.gitignore') rmSync(join(outDir, file), { recursive: true })
}

for (const name of Object.keys(entries)) {
  const config = entryConfig(name)
  await build({
    ...config,
    configFile: false,
    build: { ...config.build, watch: watch ? {} : null }
  })
}

// Every script manifest.json loads must have been built. (In watch mode the
// builds are still running here.)
if (!watch) checkManifestScripts()

function checkManifestScripts() {
  const manifest = JSON.parse(readFileSync(join(app, 'manifest.json'), 'utf8'))
  const scripts = [
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap(c => c.js || [])
  ]
  const missing = scripts.filter(s => !existsSync(join(app, s)))
  if (missing.length) {
    console.error(`manifest.json loads scripts that weren't built: ${missing}`)
    process.exit(1)
  }
}
