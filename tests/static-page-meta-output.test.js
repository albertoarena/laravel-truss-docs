import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { STATIC_PAGES } from '../scripts/static-page-meta.mjs'

// Injection happens in a build hook, so the source files stay clean and nothing
// in them proves the tags shipped. Only the built output can.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const built = (page) => readFileSync(join(distRoot, page.file), 'utf8')

const SITE = 'https://trussphp.com'

describe('the hand-authored pages carry head metadata', () => {
  it('all three were built', () => {
    for (const page of STATIC_PAGES) {
      expect(existsSync(join(distRoot, page.file)), page.file).toBe(true)
    }
  })

  it('each states its own description, exactly once', () => {
    for (const page of STATIC_PAGES) {
      const html = built(page)
      expect(html, page.file).toContain(page.description)
      expect(html.match(/name="description"/g), page.file).toHaveLength(1)
    }
  })

  it('each declares a canonical pointing at itself', () => {
    for (const page of STATIC_PAGES) {
      expect(built(page), page.file).toContain(`<link rel="canonical" href="${SITE}${page.path}">`)
    }
  })

  it('each carries the OpenGraph set, so a shared link renders', () => {
    for (const page of STATIC_PAGES) {
      const html = built(page)
      for (const tag of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image']) {
        expect(html, `${page.file} missing ${tag}`).toContain(`property="${tag}"`)
      }
      expect(html, page.file).toContain('name="twitter:card"')
    }
  })

  it('points at a cover image that exists in the build', () => {
    const match = built(STATIC_PAGES[0]).match(/property="og:image" content="([^"]+)"/)
    expect(match).not.toBeNull()
    const path = match[1].replace(SITE, '')
    expect(existsSync(join(distRoot, path.replace(/^\//, ''))), `${path} is a 404`).toBe(true)
  })

  it('keeps the title each page already had', () => {
    for (const page of STATIC_PAGES) {
      expect(built(page), page.file).toContain(`<title>${page.title}</title>`)
    }
  })

  it('leaves the source files untouched', () => {
    // The whole point of injecting: local dev keeps working, and the committed
    // HTML does not carry a hardcoded production origin.
    const source = readFileSync(
      fileURLToPath(new URL('../public/theme-builder/index.html', import.meta.url)),
      'utf8',
    )
    expect(source).not.toContain('rel="canonical"')
  })
})
