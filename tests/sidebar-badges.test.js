import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * How many things the sidebar is allowed to call New.
 *
 * It reached **ten badges across about twenty five entries**, at which point
 * the badge stopped carrying information: a reader who sees nine learns nothing
 * from any of them. Worse, none of them were new. Mapped against the release
 * that delivered each, with Truss at v1.13.0:
 *
 *   Truss as AI context   v1.8.0    five releases back
 *   MCP server            v1.8.0    five releases back
 *   Accessibility         v1.9.0    four releases back
 *   Laravel Boost         v1.10.0   three releases back
 *
 * Nothing was badged from v1.11, v1.12 or v1.13. So the badge was marking what
 * had been added at some point and never cleaned up.
 *
 * It drifted there because nothing stopped it, and a number chosen by hand
 * today will drift again the same way. The cap is what turns "add a badge" into
 * "decide which badge comes off", at the moment of adding rather than a year
 * later.
 *
 * Three rather than two, which is today's count: a cap equal to the current
 * value goes red on the next legitimate addition before anybody has had the
 * chance to make that trade. Three leaves exactly one slot and makes the fourth
 * a decision.
 *
 * Raising this number is a reasonable thing to do. Doing it without removing a
 * badge is how it got to ten.
 */

const CAP = 3

const config = readFileSync(fileURLToPath(new URL('../astro.config.mjs', import.meta.url)), 'utf8')
const newBadges = config.match(/badge: 'New'/g) ?? []

describe('the New badges in the sidebar', () => {
  it(`number no more than ${CAP}`, () => {
    expect(newBadges.length).toBeLessThanOrEqual(CAP)
  })

  it('still exist, since removing every one of them is not the goal either', () => {
    expect(newBadges.length).toBeGreaterThan(0)
  })

  it('mark the two most recent releases', () => {
    // Laravel Boost is the newest Truss feature with a page of its own, and the
    // Filament panel section is the newest thing on the site. Asserted by name
    // so that a badge surviving on something older is caught here rather than
    // only by the count.
    expect(config).toMatch(/label: 'Laravel Boost'[^\n]*badge: 'New'/)
    expect(config).toMatch(/label: 'Filament panel',\s*\n\s*badge: 'New'/)
  })

  it('leave the Live badge alone, which says a state rather than an age', () => {
    // /demo/ is live software, not a recent addition, so it never goes stale in
    // the way a New badge does and is not counted against the cap.
    // Matched within the line rather than up to the next brace: this entry
    // carries attrs: { target: '_blank' }, so a [^}] run stops short of the
    // badge and the assertion fails against correct config.
    expect(config).toMatch(/label: 'Live demo'[^\n]*badge: 'Live'/)
  })
})
