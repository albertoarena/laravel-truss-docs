import { describe, it, expect } from 'vitest'

import { STATIC_PAGES, metaTags, injectMeta } from '../scripts/static-page-meta.mjs'
import { DEMO_APPS, appPagePath } from '../scripts/demo-apps.mjs'

// The demo, its multi-connection variant and the theme builder are hand-authored
// files under public/, copied verbatim, so they never pass through either
// layout. They shipped with a <title> and, on one of them, a description. No
// canonical, no OpenGraph, nothing. They are also the most engaging pages on the
// site and the ones most likely to be shared.
//
// Injected at build time rather than written into the source, matching what
// astro.config.mjs already does to these same three files for asset versioning
// and the consent banner. That way the origin comes from the build instead of
// being hardcoded three times, so a preview build does not emit canonicals
// pointing at production.

const SITE = 'https://trussphp.com'
const COVER = `${SITE}/cover-light.png`

describe('STATIC_PAGES', () => {
  it('covers every hand-authored page, including one per demo application', () => {
    expect(STATIC_PAGES.map((page) => page.path).sort()).toEqual([
      '/demo/',
      ...DEMO_APPS.map(appPagePath),
      '/demo/multi-connection/',
      '/demo/your-schema/',
      '/theme-builder/',
    ].sort())
  })

  it('lists an entry for every demo application, so none is added to one list only', () => {
    // The failure this exists for is quiet: an application page absent from
    // STATIC_PAGES gets no canonical, no OpenGraph, no sitemap entry and no
    // consent banner, and looks perfectly fine in a browser.
    const paths = STATIC_PAGES.map((page) => page.path)
    for (const app of DEMO_APPS) {
      expect(paths, `${app.slug} is missing from STATIC_PAGES`).toContain(appPagePath(app))
    }
  })

  it('gives every page a title and a description of its own', () => {
    for (const page of STATIC_PAGES) {
      expect(page.title.length, page.path).toBeGreaterThan(10)
      expect(page.description.length, page.path).toBeGreaterThan(60)
    }
  })

  it('describes each page differently', () => {
    // Three pages sharing one description is the same as having none: nothing
    // distinguishes them in a result list or a shared link.
    const descriptions = STATIC_PAGES.map((page) => page.description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })

  it('points each entry at the file that will actually be built', () => {
    for (const page of STATIC_PAGES) {
      expect(page.file).toMatch(/index\.html$/)
      expect(`/${page.file.replace(/index\.html$/, '')}`).toBe(page.path)
    }
  })
})

describe('metaTags', () => {
  const page = STATIC_PAGES[0]
  const tags = metaTags({ site: SITE, page, cover: COVER })

  it('states a description', () => {
    expect(tags).toContain(`<meta name="description" content="${page.description}">`)
  })

  it('declares a canonical URL built from the site it was given', () => {
    expect(tags).toContain(`<link rel="canonical" href="${SITE}${page.path}">`)
  })

  it('carries the OpenGraph set a shared link needs', () => {
    expect(tags).toContain('property="og:type"')
    expect(tags).toContain(`content="${page.title}"`)
    expect(tags).toContain(`<meta property="og:url" content="${SITE}${page.path}">`)
    expect(tags).toContain(`<meta property="og:image" content="${COVER}">`)
  })

  it('carries the Twitter card', () => {
    expect(tags).toContain('name="twitter:card" content="summary_large_image"')
    expect(tags).toContain(`<meta name="twitter:image" content="${COVER}">`)
  })

  it('escapes quotes so a description cannot break out of the attribute', () => {
    const risky = { ...page, description: 'A "quoted" thing' }
    const output = metaTags({ site: SITE, page: risky, cover: COVER })
    expect(output).toContain('A &quot;quoted&quot; thing')
    expect(output).not.toContain('"A "quoted" thing"')
  })

  it('respects a non-root base without doubling the slash', () => {
    const output = metaTags({ site: 'https://example.com/preview', page, cover: COVER })
    expect(output).toContain('href="https://example.com/preview/demo/"')
  })
})

describe('injectMeta', () => {
  const html = '<!DOCTYPE html><html><head><title>T</title></head><body></body></html>'

  it('inserts the tags before the head closes', () => {
    const output = injectMeta(html, '<meta name="description" content="x">')
    expect(output).toMatch(/<meta name="description" content="x">\s*<\/head>/)
  })

  it('replaces a description the page already had, rather than adding a second', () => {
    // The theme builder was hand-authored with one. Two descriptions is worse
    // than either, because which one wins is up to the consumer.
    const withOne = html.replace('<title>T</title>', '<title>T</title><meta name="description" content="old">')
    const output = injectMeta(withOne, '<meta name="description" content="new">')

    expect(output).not.toContain('content="old"')
    expect(output.match(/name="description"/g)).toHaveLength(1)
  })

  it('is idempotent, so a rebuilt page does not accumulate tags', () => {
    const once = injectMeta(html, '<meta name="description" content="x">')
    const twice = injectMeta(once, '<meta name="description" content="x">')
    expect(twice.match(/name="description"/g)).toHaveLength(1)
  })

  it('leaves a page with no head alone rather than corrupting it', () => {
    const headless = '<html><body>hi</body></html>'
    expect(injectMeta(headless, '<meta name="description" content="x">')).toBe(headless)
  })
})
