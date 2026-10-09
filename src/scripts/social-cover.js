/**
 * Which picture a page shares when somebody pastes its link.
 *
 * Almost every page shares the same card, because almost every page is about
 * the same thing. /filament/ is not: it documents a separate Composer package,
 * albertoarena/filament-truss, and it is linked from Filament's own channels by
 * people who have never met Laravel Truss. A card showing the standalone
 * dashboard answered a question nobody in that audience had asked, so the
 * section carries the plugin's own listing art instead.
 *
 * Keyed on the collection id rather than the URL, so the rule is stated in the
 * same terms as sectionOf() in llms-txt.js and survives a SITE_BASE that puts
 * the site on a subpath. Ids keep their extension: "filament/index.mdx".
 *
 * The cards themselves live in public/ and are shipped, not built: the default
 * one by hand, the Filament one by scripts/make-filament-cover.mjs.
 *
 * Every URL built here carries ?v=<content hash>, which is not decoration. On
 * 22/09/2026 the Filament card was re-cut and redeployed, and LinkedIn went on
 * serving the old picture: the Post Inspector refetched the page (206, a real
 * fetch) and read the same og:image URL it had before, so its stored copy of the
 * image was never invalidated. The bytes had changed and the URL had not. Their
 * image cache is keyed on the URL, and no amount of re-scraping reaches it.
 *
 * astro.config explains why the demo's frontend uses a version FOLDER rather than
 * a query: truss.js imports its siblings, and those sub-requests cannot inherit a
 * query string. A card is a leaf with no sub-requests, so a query is enough here.
 *
 * og:image:width and og:image:height are read from the same bytes, for the same
 * reason. All three emitters used to declare a constant 1200x630, hardcoded by
 * the 29/07/2026 redesign against a cover that had been a 2x asset since July:
 * every page on the site told every scraper the default card was 1200x630 when
 * the file served was 2400x1260. A size computed from the file cannot drift from
 * it, the read is being done anyway for the hash, and the two cards the site
 * ships are genuinely different sizes, so no single constant was ever going to
 * be right for both.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** What every page shares unless a rule below says otherwise. */
export const DEFAULT_COVER = '/cover-light.png'

/** Section covers, keyed by the top directory of a collection id. */
export const SECTION_COVERS = {
  filament: '/filament-cover-light.jpg',
}

/**
 * The card for a docs page, as a site-root-relative path.
 *
 * A top-level page ("privacy.mdx") has no section and takes the default, which
 * is the same reading sectionOf() gives such a page.
 */
export function coverPathOf(id) {
  const [dir, ...rest] = id.split('/')
  if (rest.length === 0) return DEFAULT_COVER
  return SECTION_COVERS[dir] ?? DEFAULT_COVER
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * The pixel size a card really is, read out of its own header.
 *
 * Parsed here rather than handed to sharp because every caller is synchronous
 * (two Astro components and a build hook) and because the bytes are already in
 * memory for the hash. The test asserts these numbers against sharp, so the
 * parser is checked by something that does not share a line of code with it.
 *
 * Throws on anything that is not a PNG or a JPEG. A card in a third format would
 * otherwise declare NaN to every scraper, which is the failure this replaces.
 */
function sizeOf(bytes, path) {
  // PNG: IHDR is required to be the first chunk, so the two values sit at a
  // fixed offset past the signature and the chunk header.
  if (bytes.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  }

  // JPEG has no fixed offset: the size lives in the frame header, which sits
  // after however many metadata segments the encoder wrote, so the markers have
  // to be walked. Length counts itself, hence 2 + length.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let i = 2; i + 9 < bytes.length; ) {
      if (bytes[i] !== 0xff) break
      const marker = bytes[i + 1]
      // A run of 0xff is padding before the next marker, and RSTn and EOI carry
      // no length field to skip by.
      if (marker === 0xff) i += 1
      else if (marker >= 0xd0 && marker <= 0xd9) i += 2
      // SOF0 to SOF15, less the three markers sharing that range that are not
      // frame headers at all: DHT, JPG and DAC. Height precedes width.
      else if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: bytes.readUInt16BE(i + 7), height: bytes.readUInt16BE(i + 5) }
      } else i += 2 + bytes.readUInt16BE(i + 2)
    }
  }

  throw new Error(`public${path} is not a PNG or a JPEG, so its size cannot be declared`)
}

/**
 * One read per card: eight hex of its content, and its size.
 *
 * The hash is why re-cutting a card changes every URL that points at it, so each
 * platform refetches without being asked.
 *
 * Read from public/ relative to the working directory, which every entry point
 * shares: npm scripts run from the repo root, and so do the build hooks and the
 * test runner. Cached, because this is called once per page per card.
 */
const cards = new Map()

function cardFile(path) {
  if (!cards.has(path)) {
    const bytes = readFileSync(join(process.cwd(), 'public', path))
    cards.set(path, {
      version: createHash('sha256').update(bytes).digest('hex').slice(0, 8),
      ...sizeOf(bytes, path),
    })
  }
  return cards.get(path)
}

export function versionOf(path) {
  return cardFile(path).version
}

/** The size of the file being served, which is what the tags have to declare. */
export function dimensionsOf(path) {
  const { width, height } = cardFile(path)
  return { width, height }
}

/** Absolute and versioned, which is what OpenGraph requires and what caches need. */
export function coverUrl(path, { site, base = '' }) {
  return `${new URL(`${base}${path}`, site).href}?v=${versionOf(path)}`
}

/**
 * Everything the three card tag sets need, from one argument.
 *
 * Returned together on purpose. A caller handed a URL and a size separately can
 * declare a size belonging to a different file, and for two and a half months
 * every page on this site did exactly that.
 */
export function cardOf(path, { site, base = '' }) {
  return { url: coverUrl(path, { site, base }), ...dimensionsOf(path) }
}

/** The same, for a docs page, from its collection id. */
export function cardOfPage(id, { site, base = '' }) {
  return cardOf(coverPathOf(id), { site, base })
}
