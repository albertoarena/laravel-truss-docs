import { describe, it, expect } from 'vitest'
import { STATIC_PAGES } from '../scripts/static-page-meta.mjs'
import { staticPageUrls, addUrls } from '../scripts/static-page-sitemap.mjs'

// Starlight generates the sitemap from its own content collections, so the
// three hand-authored pages under public/ were absent from it: 18 URLs, none of
// them the demo or the theme builder. Google found them by link alone, which is
// why they were the last pages to be reconciled after the canonical fix.
//
// They are appended to the built sitemap rather than declared separately, and
// the list comes from STATIC_PAGES, the same array that drives their head
// metadata, so a fourth static page cannot be added to one and forgotten in the
// other.

describe('static page sitemap URLs', () => {
  it('derives one absolute URL per hand-authored page', () => {
    const urls = staticPageUrls('https://trussphp.com')

    expect(urls).toHaveLength(STATIC_PAGES.length)
    expect(urls).toContain('https://trussphp.com/demo/')
    expect(urls).toContain('https://trussphp.com/demo/multi-connection/')
    expect(urls).toContain('https://trussphp.com/theme-builder/')
  })

  it('does not double the slash when the origin carries one', () => {
    expect(staticPageUrls('https://trussphp.com/')).toContain('https://trussphp.com/demo/')
  })

  it('follows the origin, so a preview build stays on its own host', () => {
    // The same reason the canonical tags are injected at build time rather than
    // written into the three source files.
    const urls = staticPageUrls('https://preview.example')

    expect(urls.every((u) => u.startsWith('https://preview.example/'))).toBe(true)
  })
})

describe('appending them to the built sitemap', () => {
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    '<url><loc>https://trussphp.com/</loc></url>' +
    '</urlset>'

  it('inserts each URL before the closing tag', () => {
    const out = addUrls(xml, ['https://trussphp.com/demo/'])

    expect(out).toContain('<url><loc>https://trussphp.com/demo/</loc></url></urlset>')
    expect(out).toContain('<loc>https://trussphp.com/</loc>')
  })

  it('never adds a URL the sitemap already lists', () => {
    // Guards a rebuild over an existing dist/, and guards the day Starlight
    // learns to emit these itself. A duplicated <loc> is an invalid sitemap.
    const out = addUrls(xml, ['https://trussphp.com/'])

    expect(out).toBe(xml)
  })

  it('is idempotent', () => {
    const once = addUrls(xml, ['https://trussphp.com/demo/'])

    expect(addUrls(once, ['https://trussphp.com/demo/'])).toBe(once)
  })

  it('escapes what XML requires escaping', () => {
    const out = addUrls(xml, ['https://trussphp.com/a?x=1&y=2'])

    expect(out).toContain('<loc>https://trussphp.com/a?x=1&amp;y=2</loc>')
  })

  it('leaves a sitemap it does not recognise untouched', () => {
    // Better to ship the 18 URLs that already work than to corrupt the file.
    expect(addUrls('<nonsense/>', ['https://trussphp.com/demo/'])).toBe('<nonsense/>')
  })
})
