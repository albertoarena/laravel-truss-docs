import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { STATIC_PAGES } from '../scripts/static-page-meta.mjs'
import { MENU_PAGES } from '../scripts/demo-nav.mjs'

/**
 * The menu script after the build, which is the only place its arrangement can
 * be seen.
 *
 * The source shells carry `<script src="/demo/site-menu.js">` so that
 * `npm run dev` serves a working menu from one file. The build replaces each
 * tag with the file's contents, which is the same shape `staticPageConsent`
 * already uses for the consent snippet, on the same set of pages.
 *
 * Inlining is not a refinement here, it is the answer to a measured problem:
 * the origin serves `text/css` with `max-age=604800` and JavaScript with **no
 * Cache-Control at all**, so a separately served script gets heuristic caching
 * nobody chose. An inlined script's lifetime is the page's lifetime, so there
 * is no URL left to go stale. PR #28 does not change this: it covers HTML and
 * _astro/ only.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const distRoot = join(root, 'dist')
const SHELLS = STATIC_PAGES.filter((page) => MENU_PAGES.includes(page.path))
const built = (page) => readFileSync(join(distRoot, page.file), 'utf8')
const source = readFileSync(join(root, 'public', 'demo', 'site-menu.js'), 'utf8').trim()

describe('the menu script is inlined into the built pages', () => {
  it('covers every page that carries the site bar', () => {
    // Five: the four demo shells and the theme builder. The plan filtered the
    // theme builder out as "not a demo shell", which was true and beside the
    // point: it has the same bar, it had the same defect, and on a phone it
    // offered the logo and an outbound GitHub link and nothing else.
    expect(SHELLS.map((page) => page.path).sort()).toEqual([...MENU_PAGES].sort())
    expect(SHELLS.length).toBe(5)
  })

  it('carries the script body in each shell', () => {
    for (const page of SHELLS) {
      expect(built(page), `${page.path}: the menu script was not inlined`).toContain(source)
    }
  })

  it('leaves no reference to the source file', () => {
    // A surviving tag means the hook did not run. The page still works, which
    // is the point of keeping a real src in the source, but it must not ship
    // quietly: this is the assertion that says so.
    for (const page of SHELLS) {
      expect(built(page), `${page.path}: the script tag survived the build`)
        .not.toContain('src="/demo/site-menu.js"')
    }
  })

  it('does not ship the source file as a stray', () => {
    // Astro copies public/ into dist/, so the file is published even once every
    // tag has been replaced. Harmless, but it is a stray on a site that sets
    // Options -Indexes. The hook deletes it, and only after every page was
    // inlined: deleting after a partial run would leave a dead script tag on
    // the page it missed, which is the no-menu failure this arrangement exists
    // to avoid.
    expect(existsSync(join(distRoot, 'demo', 'site-menu.js'))).toBe(false)
  })
})
