import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { AUTHOR_NAME, AUTHOR_PROFILE } from '../src/config/package.js'

/**
 * The byline, in the form a social platform reads.
 *
 * The JSON-LD has carried a Person since structured data was added, and every
 * TechArticle points at it. LinkedIn reads neither: its Post Inspector reported
 * "No author found" for /filament/ on 22/09/2026, with the graph sitting in the
 * same document saying otherwise. Rich structured data is not a substitute for
 * the two meta tags, and nothing in this repo could see the gap because every
 * assertion about authorship was against the graph.
 *
 * Three paths emit head tags and share no code: SiteLayout for the landing, the
 * roadmap and in the wild, the Starlight head array for the docs, and
 * scripts/static-page-meta.mjs injecting into the pages copied out of public/.
 * The name has to reach all three, which is what this asserts.
 */

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))

function htmlPages(dir = distRoot) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...htmlPages(full))
    else if (entry.endsWith('.html')) out.push(full)
  }
  return out
}

/** A real page, not one of the demo's inner frames: the cards mark them out. */
const pages = htmlPages()
  .map((file) => ({ route: `/${relative(distRoot, file).replace(/index\.html$/, '')}`, html: readFileSync(file, 'utf8') }))
  .filter((page) => page.html.includes('property="og:image"'))

const attr = (html, re) => html.match(re)?.[1]

describe('the byline on every built page', () => {
  it('found pages to check', () => {
    expect(pages.length).toBeGreaterThan(15)
  })

  it('names the author in the tag a platform reads', () => {
    for (const page of pages) {
      expect(attr(page.html, /<meta name="author" content="([^"]*)"/), page.route).toBe(AUTHOR_NAME)
    }
  })

  it('reached all three head paths', () => {
    // Guards the assertion above against passing because one path emits nothing
    // and its pages were filtered out. One page of each kind, named.
    for (const route of ['/', '/filament/', '/demo/']) {
      expect(
        pages.find((page) => page.route === route),
        `${route} is not in the built output`,
      ).toBeDefined()
    }
  })

  it('adds article:author only where the page is an article', () => {
    // article:author belongs to the og article namespace. Starlight sets
    // og:type=article on the docs; the landing and the demo are websites, and a
    // byline in the article namespace on a non-article is noise at best.
    for (const page of pages) {
      const isArticle = page.html.includes('content="article"')
      const author = attr(page.html, /<meta property="article:author" content="([^"]*)"/)

      if (isArticle) expect(author, page.route).toBe(AUTHOR_PROFILE)
      else expect(author, `${page.route} is not an article`).toBeUndefined()
    }
  })
})
