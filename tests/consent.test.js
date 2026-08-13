import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  STORAGE_KEY,
  ACCEPTED,
  DECLINED,
  readConsent,
  shouldShowBanner,
  analyticsAllowed,
  storeConsent,
  clearConsent,
} from '../src/scripts/consent.js'

// The consent decision is the one piece of this feature that must not be got
// wrong: everything about whether Google is contacted at all hangs off it. It
// lives in a plain module rather than inline in the component precisely so it
// can be tested here, without a browser.

/** Minimal localStorage stand-in. `broken` models Safari private mode and any
 *  browser where touching storage throws rather than returning null. */
const fakeStorage = ({ initial = {}, broken = false } = {}) => {
  const data = { ...initial }
  const boom = () => {
    throw new Error('storage unavailable')
  }
  return {
    getItem: broken ? boom : (k) => (k in data ? data[k] : null),
    setItem: broken ? boom : (k, v) => {
      data[k] = String(v)
    },
    removeItem: broken ? boom : (k) => {
      delete data[k]
    },
    _data: data,
  }
}

describe('consent state', () => {
  it('shows the banner when no choice has been made', () => {
    expect(shouldShowBanner(null)).toBe(true)
  })

  it('does not show the banner once a choice exists, either way', () => {
    expect(shouldShowBanner(ACCEPTED)).toBe(false)
    expect(shouldShowBanner(DECLINED)).toBe(false)
  })

  it('treats an unrecognised stored value as no choice, so the banner returns', () => {
    // A stale or hand-edited value must not be read as consent by accident.
    expect(shouldShowBanner('yes')).toBe(true)
    expect(shouldShowBanner('')).toBe(true)
  })

  it('allows analytics only on an explicit accept', () => {
    expect(analyticsAllowed(ACCEPTED)).toBe(true)
    expect(analyticsAllowed(DECLINED)).toBe(false)
    expect(analyticsAllowed(null)).toBe(false)
    expect(analyticsAllowed('granted')).toBe(false)
  })
})

describe('consent storage', () => {
  it('round-trips a choice', () => {
    const s = fakeStorage()
    storeConsent(s, ACCEPTED)
    expect(readConsent(s)).toBe(ACCEPTED)
    expect(s._data[STORAGE_KEY]).toBe(ACCEPTED)
  })

  it('clears a choice, which is how consent is withdrawn', () => {
    const s = fakeStorage({ initial: { [STORAGE_KEY]: ACCEPTED } })
    clearConsent(s)
    expect(readConsent(s)).toBeNull()
    expect(shouldShowBanner(readConsent(s))).toBe(true)
  })

  it('refuses to store anything other than a real choice', () => {
    const s = fakeStorage()
    expect(() => storeConsent(s, 'maybe')).toThrow()
    expect(s._data[STORAGE_KEY]).toBeUndefined()
  })

  it('degrades to no-choice when storage throws, rather than breaking the page', () => {
    // Storage can throw outright. If that took the script down, the banner
    // would never render and the page would look broken for those visitors.
    const s = fakeStorage({ broken: true })
    expect(readConsent(s)).toBeNull()
    expect(() => storeConsent(s, ACCEPTED)).not.toThrow()
    expect(() => clearConsent(s)).not.toThrow()
  })

  it('degrades to no-choice when there is no storage at all', () => {
    expect(readConsent(undefined)).toBeNull()
    expect(() => storeConsent(undefined, ACCEPTED)).not.toThrow()
  })
})

describe('the banner component', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../src/components/CookieConsent.astro', import.meta.url)),
    'utf8',
  )

  it('is a labelled dialog', () => {
    expect(source).toMatch(/role="dialog"/)
    expect(source).toMatch(/aria-labelledby=/)
    expect(source).toMatch(/aria-describedby=/)
  })

  it('uses real buttons, so they are keyboard operable for free', () => {
    expect(source.match(/<button/g) ?? []).toHaveLength(2)
  })

  it('gives decline and accept the same sizing class', () => {
    // The anti-dark-pattern rule, pinned. Consent is only valid if refusing is
    // as easy as agreeing, so both controls share one class that carries the
    // padding and font size. Colour may differ; weight and hit area may not.
    const buttons = [...source.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1])
    expect(buttons).toHaveLength(2)
    for (const cls of buttons) expect(cls.split(/\s+/)).toContain('consent-btn')
  })

  it('overlays rather than displacing content, so it cannot reintroduce CLS', () => {
    expect(source).toMatch(/position:\s*fixed/)
  })

  it('moves itself to the body, so an ancestor stacking context cannot trap it', () => {
    // On the docs pages Starlight renders this inside .main-pane, which creates
    // a stacking context. A fixed banner inside one is confined to it and paints
    // under the sidebar however high its z-index goes, so escaping the context
    // is the fix and raising the number is not.
    expect(source).toMatch(/document\.body\.appendChild\(banner\)/)
  })

  it('links to the privacy page', () => {
    expect(source).toMatch(/href="\/privacy\/"/)
  })

  it('never names a Google URL itself, so the tag can only arrive via the gated loader', () => {
    expect(source).not.toMatch(/googletagmanager|google-analytics/i)
  })

  it('gates loading on an explicit accept', () => {
    // The wiring that matters: analytics must be reached through the consent
    // check, never called unconditionally on load.
    expect(source).toMatch(/analyticsAllowed/)
    expect(source).toMatch(/loadAnalytics/)
  })
})

describe('built output with no measurement ID configured', () => {
  let pages = []

  beforeAll(() => {
    const paths = [
      'index.html',
      'roadmap/index.html',
      'getting-started/installation/index.html',
    ].map((p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url)))

    for (const p of paths) {
      if (!existsSync(p)) throw new Error('dist not built. Run `npm run build` first.')
    }
    pages = paths.map((p) => readFileSync(p, 'utf8'))
  })

  it('renders no banner, because an unset ID means nothing to consent to', () => {
    // Shipping a banner while no analytics exist would ask visitors to agree to
    // nothing. The ID is the switch for both the tag and the banner.
    for (const html of pages) expect(html).not.toMatch(/id="cookie-consent"/)
  })

  it('contacts Google from no page', () => {
    for (const html of pages) expect(html).not.toMatch(/googletagmanager|google-analytics/i)
  })
})
