import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

import {
  DEFAULT_COVER,
  SECTION_COVERS,
  coverPathOf,
  coverUrlOf,
  versionOf,
} from '../src/scripts/social-cover.js'

/**
 * The rule that decides which card a page shares.
 *
 * /filament/ documents albertoarena/filament-truss and is linked from Filament's
 * own channels, where the standalone dashboard is not what the reader came for.
 * Everything else shares the one card the site has always shared, and that half
 * matters as much: a section rule with a wrong boundary is how a page quietly
 * starts advertising the wrong package.
 */

const localPath = (p) => fileURLToPath(new URL(`../public${p}`, import.meta.url))

describe('the social card for a docs page', () => {
  it('is the Filament art for every page in that section', () => {
    for (const id of [
      'filament/index.mdx',
      'filament/installation.mdx',
      'filament/configuration.mdx',
      'filament/theming.mdx',
      'filament/open-on-a-table.mdx',
    ]) {
      expect(coverPathOf(id)).toBe(SECTION_COVERS.filament)
    }
  })

  it('is the default everywhere else', () => {
    for (const id of [
      'getting-started/installation.mdx',
      'guides/theming.mdx',
      'reference/configuration.mdx',
      'help/troubleshooting.mdx',
    ]) {
      expect(coverPathOf(id)).toBe(DEFAULT_COVER)
    }
  })

  it('is the default for a page with no section at all', () => {
    // Matches what sectionOf() reads such a page as. A top-level page has no
    // directory to key on, and falling through to a section cover would be a
    // coincidence of string matching rather than a decision.
    expect(coverPathOf('privacy.mdx')).toBe(DEFAULT_COVER)
    expect(coverPathOf('index.mdx')).toBe(DEFAULT_COVER)
  })

  it('does not match a section by prefix', () => {
    // "filament-something" is not the Filament section, and a startsWith() test
    // on the path would have said it was.
    expect(coverPathOf('filament-panel/index.mdx')).toBe(DEFAULT_COVER)
  })

  it('names files that are actually in public/', () => {
    // The tags are absolute URLs, so a typo here is a 404 no build step sees:
    // the page still renders and the card is simply missing wherever it is
    // pasted. Nothing else in this repo would catch that.
    for (const path of [DEFAULT_COVER, ...Object.values(SECTION_COVERS)]) {
      expect(existsSync(localPath(path)), `public${path} is missing`).toBe(true)
    }
  })

  it('names files cut to the shape the tags declare', async () => {
    // Every page declares og:image:width 1200 and height 630. A card that is not
    // that shape gets cropped by each platform to its own taste, which is the
    // failure this whole file exists to avoid, and no test upstream of the pixels
    // can see it. A whole multiple is allowed because cover-light.png is 2400x1260
    // and flat art survives the platforms' downscale; the ratio is not negotiable.
    for (const path of [DEFAULT_COVER, ...Object.values(SECTION_COVERS)]) {
      const { width, height } = await sharp(localPath(path)).metadata()

      expect(width % 1200, `public${path} is ${width} wide, not a multiple of 1200`).toBe(0)
      expect(height, `public${path} is ${width}x${height}, not the card ratio`).toBe(
        (width / 1200) * 630,
      )
    }
  })
})

describe('the absolute form', () => {
  it('is the origin plus the path, versioned', () => {
    expect(coverUrlOf('filament/index.mdx', { site: 'https://trussphp.com/' })).toBe(
      `https://trussphp.com/filament-cover-light.jpg?v=${versionOf(SECTION_COVERS.filament)}`,
    )
  })

  it('carries a SITE_BASE subpath', () => {
    // A preview build can be served from a subpath, and an OpenGraph image that
    // dropped it would point at a file the preview does not host.
    expect(
      coverUrlOf('guides/theming.mdx', { site: 'https://example.test/', base: '/preview' }),
    ).toBe(`https://example.test/preview/cover-light.png?v=${versionOf(DEFAULT_COVER)}`)
  })
})

describe('the version', () => {
  /**
   * Re-cutting a card has to change its URL, or the change never reaches anyone.
   * LinkedIn refetched /filament/ after the card was recut on 22/09/2026, read
   * the same og:image URL, and went on serving its stored copy of the old image.
   * Their cache is keyed on the URL and no re-scrape reaches it.
   */
  it('is taken from the bytes of the file it points at', () => {
    expect(versionOf(DEFAULT_COVER)).toMatch(/^[0-9a-f]{8}$/)
    expect(versionOf(SECTION_COVERS.filament)).toMatch(/^[0-9a-f]{8}$/)
  })

  it('differs between two different cards', () => {
    // A constant, or a version read from package.js, would pass the test above
    // and still hand every platform one unchanging URL per card.
    expect(versionOf(DEFAULT_COVER)).not.toBe(versionOf(SECTION_COVERS.filament))
  })
})
