/**
 * The navigation the hand-authored demo shells carry.
 *
 * There is one list here because there were four, and they had already drifted:
 * `/demo/` and `/demo/your-schema/` offered Theme builder while
 * `/demo/multi-connection/` and `/demo/apps/lunar/` did not, neither
 * app-adjacent shell linked to the multi-connection page, and the same
 * destination was labelled "Demo" in two files and "Sample demo" in a third.
 * Nobody decided any of that. It is the same drift `DEMO_APPS` was written to
 * stop for the asset rewrite, the consent banner, the head metadata and the
 * sitemap, and this is the fifth list joining them.
 *
 * The markup is still hand-authored, so this does not generate anything. It is
 * what the tests compare each shell against, which means adding an application
 * fails the suite until every shell links to it.
 *
 * Paths are site-absolute. The shells use relative paths for their assets,
 * because the version rewrite depends on it, but a nav link has no such
 * constraint and four different relative depths spelling the same destination
 * is how a link gets fixed in one file and left wrong in three.
 */
import { DEMO_APPS, appPagePath } from './demo-apps.mjs'

/** Every page that renders the dashboard, in the order a reader meets them. */
export const DEMO_SHELLS = [
  { path: '/demo/', label: 'Sample demo' },
  { path: '/demo/your-schema/', label: 'Your own schema' },
  { path: '/demo/multi-connection/', label: 'Multiple connections' },
  ...DEMO_APPS.map((app) => ({ path: appPagePath(app), label: `${app.name}'s schema` })),
]

/**
 * The rest of the site, after the demos.
 *
 * GitHub is deliberately absent: it is a bar control rather than a nav link.
 * It stays reachable in one tap at every width, and `.site-bar-actions` is
 * where that is expressed.
 */
export const SITE_LINKS = [
  { path: '/theme-builder/', label: 'Theme builder' },
  { path: '/getting-started/installation/', label: 'Docs' },
  { path: '/roadmap/', label: 'Roadmap' },
]

/**
 * Every hand-authored page that carries the site bar, and therefore the menu.
 *
 * The theme builder is one of them. The plan said to filter it out of the
 * injection, on the grounds that it is not a demo shell and would get a menu
 * full of demo links. Half right: it is not a demo shell, but filtering it left
 * it with the same defect this whole change is about. On a phone it offered the
 * logo and an outbound GitHub link and nothing else, from a fifth copy of the
 * same rule with a fifth breakpoint (`max-width: 620px`). It gets the menu,
 * with its own set: the demos it is a companion to, Docs and Roadmap.
 */
export const MENU_PAGES = [
  ...DEMO_SHELLS.map((shell) => shell.path),
  '/theme-builder/',
]

/**
 * What one page links to: every other demo, then the rest of the site.
 *
 * A page never links to itself, which is why this takes the current path rather
 * than being a constant, and why the filter covers both lists: the theme
 * builder appears in SITE_LINKS and must not link to itself either.
 */
export const navLinks = (currentPath) => [
  ...DEMO_SHELLS.filter((shell) => shell.path !== currentPath),
  ...SITE_LINKS.filter((link) => link.path !== currentPath),
]

/**
 * The width at or below which the nav becomes a panel.
 *
 * Measured, not chosen. The plan picked 720 to clear the band where `/demo/`
 * used to overflow its bar, but that was the old item set: four or five links
 * with GitHub inside the nav. With the canonical set and GitHub moved out to
 * the bar, the widest inline bar (`/demo/`, six links plus the palette row)
 * needs **1014px**, so at 721 it overflowed again, in the same way and for the
 * same reason. Every previous number here was chosen against one item set and
 * silently reopened a band when the set changed.
 *
 * 1024 is above the measured requirement with ten pixels of headroom, and it is
 * a familiar collapse point rather than an arbitrary one. It is exported so the
 * shells, the tests and the browser spec cannot disagree about it, and the spec
 * asserts nothing overflows at exactly this width and one pixel above, so
 * adding a link fails a test rather than reopening the band.
 */
export const MENU_BREAKPOINT = 1024

/**
 * The panel holds one row per link, and on `/demo/` one more for the palette
 * controls. It cannot scroll: the canvas calls preventDefault on wheel.
 *
 * Seven, measured on a phone in landscape rather than derived. The case that
 * binds is the narrow landscape phone, not the wide one: a 932x430 viewport is
 * above the breakpoint and gets the inline nav, so the panel's worst case is
 * something like 667x375, where 375 less the 48px bar and the padding fits
 * seven 44px rows. Checked in the browser: `/demo/` renders seven rows from
 * y=48 to y=354, with 21px to spare.
 *
 * `/demo/` is therefore **at the ceiling today**, which is the point of holding
 * it in a test: the second application does not quietly overflow a panel nobody
 * can scroll, it fails here and forces the list to be grouped or truncated
 * first.
 */
export const PANEL_ROW_CEILING = 7
