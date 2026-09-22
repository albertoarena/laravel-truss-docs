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
 */

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

/** The same, absolute, which is what OpenGraph requires. */
export function coverUrlOf(id, { site, base = '' }) {
  return new URL(`${base}${coverPathOf(id)}`, site).href
}
