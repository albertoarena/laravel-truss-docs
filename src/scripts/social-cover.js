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

/**
 * Eight hex of the file's content, so re-cutting a card changes every URL that
 * points at it and each platform refetches without being asked.
 *
 * Read from public/ relative to the working directory, which every entry point
 * shares: npm scripts run from the repo root, and so do the build hooks and the
 * test runner. Cached, because this is called once per page per card.
 */
const versions = new Map()

export function versionOf(path) {
  if (!versions.has(path)) {
    const file = join(process.cwd(), 'public', path)
    versions.set(path, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8))
  }
  return versions.get(path)
}

/** Absolute and versioned, which is what OpenGraph requires and what caches need. */
export function coverUrl(path, { site, base = '' }) {
  return `${new URL(`${base}${path}`, site).href}?v=${versionOf(path)}`
}

/** The same, for a docs page, from its collection id. */
export function coverUrlOf(id, { site, base = '' }) {
  return coverUrl(coverPathOf(id), { site, base })
}
