import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { STATIC_PAGES } from '../scripts/static-page-meta.mjs'

// The unit tests cover the function. This covers the wiring: that the build
// actually runs it, against the sitemap Starlight generates rather than a
// fixture. The failure mode it exists for is silent, because a sitemap missing
// three URLs is still a valid sitemap and nothing in the build would complain.

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

describe('the built sitemap', () => {
  let xml = ''

  beforeAll(() => {
    const path = dist('sitemap-0.xml')
    if (!existsSync(path)) {
      throw new Error('dist/sitemap-0.xml missing. Either the build was not run, or Starlight stopped emitting a sitemap.')
    }
    xml = readFileSync(path, 'utf8')
  })

  it('lists every hand-authored static page', () => {
    for (const page of STATIC_PAGES) {
      expect(xml).toContain(`<loc>https://trussphp.com${page.path}</loc>`)
    }
  })

  it('still lists the pages Starlight generates', () => {
    expect(xml).toContain('<loc>https://trussphp.com/</loc>')
    expect(xml).toContain('<loc>https://trussphp.com/roadmap/</loc>')
    expect(xml).toContain('<loc>https://trussphp.com/guides/theming/</loc>')
  })

  it('lists nothing twice', () => {
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

    expect(locs.length).toBe(new Set(locs).size)
  })

  it('lists the canonical form of each page, not a redirecting one', () => {
    // Every URL here now 301s unless it is https, apex and directory-form, so a
    // sitemap entry in any other shape would point search engines at a redirect.
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

    for (const loc of locs) {
      expect(loc.startsWith('https://trussphp.com/')).toBe(true)
      expect(loc).not.toContain('index.html')
    }
  })
})
