import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { DEFAULT_COVER, SECTION_COVERS } from '../src/scripts/social-cover.js'

/**
 * The card a built page actually carries.
 *
 * The unit test proves the rule; this proves the rule reaches the HTML, which is
 * the part that has bitten this repo before. Three paths emit these tags and
 * none of them share code with the others: SiteLayout for the landing, roadmap
 * and in the wild, the Head override for everything Starlight renders, and
 * scripts/static-page-meta.mjs injecting into the demo and the theme builder
 * after the build. A card set in one of them is set for a third of the site.
 *
 * The count assertion is the other half. og:image used to come from the head
 * array in astro.config, which applies to every Starlight page equally; the
 * per-section card only works because that entry came out. Left in, every
 * Filament page would carry two og:image tags and each scraper would pick a
 * different one, which is worse than either card on its own.
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

const tags = (html, attr, value) => [
  ...html.matchAll(new RegExp(`<meta[^>]*${attr}="${value}"[^>]*>`, 'g')),
].map((match) => match[0].match(/content="([^"]*)"/)?.[1])

/** Only the pages that ship a card at all: the demo's inner frames do not. */
const carded = htmlPages()
  .map((file) => ({
    route: `/${relative(distRoot, file).replace(/index\.html$/, '')}`,
    og: tags(readFileSync(file, 'utf8'), 'property', 'og:image'),
    twitter: tags(readFileSync(file, 'utf8'), 'name', 'twitter:image'),
  }))
  .filter((page) => page.og.length > 0)

describe('the built pages', () => {
  it('were built, and carry cards', () => {
    expect(carded.length).toBeGreaterThan(15)
  })

  it('each carry exactly one og:image and one twitter:image', () => {
    for (const page of carded) {
      expect(page.og.length, `${page.route} has ${page.og.length} og:image tags`).toBe(1)
      expect(page.twitter.length, `${page.route} has ${page.twitter.length}`).toBe(1)
    }
  })

  it('share the Filament art from the Filament section and nowhere else', () => {
    const expected = (route) =>
      route.startsWith('/filament/') ? SECTION_COVERS.filament : DEFAULT_COVER

    for (const page of carded) {
      expect(page.og[0], `${page.route} shares the wrong card`).toBe(
        `https://trussphp.com${expected(page.route)}`,
      )
      expect(page.twitter[0], `${page.route} shares the wrong card on Twitter`).toBe(page.og[0])
    }
  })

  it('reached at least one page of each kind', () => {
    // Guards the assertion above against passing because a section is empty.
    const routes = carded.map((page) => page.route)
    expect(routes.filter((route) => route.startsWith('/filament/')).length).toBeGreaterThan(4)
    expect(routes.filter((route) => !route.startsWith('/filament/')).length).toBeGreaterThan(10)
  })

  it('point at cards the build actually shipped', () => {
    for (const path of new Set(carded.map((page) => page.og[0]))) {
      const file = join(distRoot, new URL(path).pathname)
      expect(existsSync(file), `${path} is not in dist`).toBe(true)
    }
  })
})
