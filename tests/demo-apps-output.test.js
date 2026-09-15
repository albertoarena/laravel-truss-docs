import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { DEMO_APPS, appPageFile, appPagePath } from '../scripts/demo-apps.mjs'

/**
 * What the per-application pages look like after the build, which is the only
 * place the failure they were written around can be seen.
 *
 * demoAssetVersioning renames demo/assets/ to demo/assets-<version>/ and
 * repoints the pages it knows about. A page it does not know about keeps
 * pointing at demo/assets/, which by then does not exist. Nothing warns: the
 * rename succeeded, the page was copied, the HTML is valid. It renders
 * correctly under `npm run dev`, where no rename happens, and shows an empty
 * diagram in production.
 *
 * The source tests cannot see any of that, because the source is deliberately
 * left with plain ../../assets/ so local development works.
 */

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const built = (app) => readFileSync(join(distRoot, appPageFile(app)), 'utf8')

/** The stamp the build resolved, which names the folder the assets moved to. */
const stamp = (() => {
  const file = fileURLToPath(new URL('../.demo-asset-version', import.meta.url))
  return existsSync(file) ? readFileSync(file, 'utf8').trim().replace(/[^A-Za-z0-9._-]/g, '-') : null
})()

describe('the built application pages', () => {
  it('were built, at the URL the registry declares', () => {
    for (const app of DEMO_APPS) {
      expect(existsSync(join(distRoot, appPageFile(app))), appPageFile(app)).toBe(true)
      expect(`/${appPageFile(app).replace(/index\.html$/, '')}`).toBe(appPagePath(app))
    }
  })

  it('ships each snapshot beside its page', () => {
    for (const app of DEMO_APPS) {
      const file = join(distRoot, 'demo', 'apps', app.slug, 'schema.json')
      expect(existsSync(file), `${app.slug}: schema.json is not in the build`).toBe(true)
      expect(JSON.parse(readFileSync(file, 'utf8')).tables.length).toBe(app.tables)
    }
  })

  it('points at the version-stamped asset folder, not the one the rename emptied', () => {
    // This is the whole reason the file exists.
    if (!stamp) return
    for (const app of DEMO_APPS) {
      const page = built(app)
      expect(page, `${app.slug}: still points at the pre-rename folder`)
        .not.toMatch(/(?:src|href)="\.\.\/\.\.\/assets\//)
      expect(page, `${app.slug}: no reference to assets-${stamp}`)
        .toContain(`../../assets-${stamp}/`)
    }
  })

  it('points at an asset folder that is actually in the build', () => {
    // A stamp agreeing with itself proves nothing if the folder is not there.
    for (const app of DEMO_APPS) {
      const references = [...built(app).matchAll(/(?:src|href)="(\.\.\/\.\.\/assets[^"]*)"/g)].map((m) => m[1])
      expect(references.length, `${app.slug}: no asset references`).toBeGreaterThan(0)
      for (const reference of references) {
        const file = join(distRoot, 'demo', 'apps', app.slug, reference)
        expect(existsSync(file), `${app.slug}: ${reference} is a 404`).toBe(true)
      }
    }
  })

  it('carries the head metadata the injection adds, exactly once', () => {
    for (const app of DEMO_APPS) {
      const page = built(app)
      expect(page.match(/name="description"/g), `${app.slug}`).toHaveLength(1)
      expect(page, `${app.slug}`).toContain(
        `<link rel="canonical" href="https://trussphp.com${appPagePath(app)}">`,
      )
    }
  })

  it('keeps the clean directory URL as its canonical, despite the focus query', () => {
    // The page rewrites its own address bar to ?focus=... on load. That must
    // not reach the canonical, or every application page would nominate a
    // query-string URL as the one to index.
    for (const app of DEMO_APPS) {
      const canonical = built(app).match(/rel="canonical" href="([^"]+)"/)?.[1]
      expect(canonical, `${app.slug}`).not.toContain('?')
    }
  })

  it('is listed in the sitemap', () => {
    const xml = readFileSync(join(distRoot, 'sitemap-0.xml'), 'utf8')
    for (const app of DEMO_APPS) {
      expect(xml, `${app.slug}`).toContain(`<loc>https://trussphp.com${appPagePath(app)}</loc>`)
    }
  })

  it('leaves the committed source pointing at the unstamped folder', () => {
    // Local development has no rename, so a stamp written into the source would
    // break `npm run dev` and make the next build stamp a stamped path.
    for (const app of DEMO_APPS) {
      const source = readFileSync(join(fileURLToPath(new URL('../public', import.meta.url)), appPageFile(app)), 'utf8')
      expect(source, `${app.slug}`).toContain('../../assets/truss.css')
      // The references, not the file: the shell's comments explain the rename
      // and name the stamped folder while doing it.
      const references = [...source.matchAll(/(?:src|href)="([^"]*assets[^"]*)"/g)].map((m) => m[1])
      for (const reference of references) {
        expect(reference, `${app.slug}: a version stamp was written into the source`)
          .not.toMatch(/assets-/)
      }
    }
  })
})
