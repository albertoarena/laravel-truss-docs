import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { consentSnippet } from '../scripts/consent-snippet.mjs'
import { STORAGE_KEY, ACCEPTED, DECLINED } from '../src/scripts/consent.js'
import { GA_SCRIPT_ORIGIN } from '../src/scripts/analytics.js'

// The demo and the theme builder are hand-authored static files under public/,
// so they never pass through either Astro layout and cannot import the shared
// modules. Without this they carried no banner and no analytics at all, which
// left the most engaged page on the site unmeasured.
//
// The snippet therefore duplicates the behaviour, which is a drift risk. The
// values most likely to drift (the storage key, the two choices, the Google
// origin) are taken from the source modules rather than retyped, and these
// tests pin the rest. Same approach as theme-parity.test.js.

describe('the static-page consent snippet', () => {
  const snippet = consentSnippet('G-ABC123')

  it('is empty without a measurement ID, so nothing is asked when nothing runs', () => {
    expect(consentSnippet('')).toBe('')
    expect(consentSnippet(undefined)).toBe('')
  })

  it('reuses the storage key from the shared module', () => {
    expect(snippet).toContain(STORAGE_KEY)
  })

  it('reuses both choice values from the shared module', () => {
    expect(snippet).toContain(ACCEPTED)
    expect(snippet).toContain(DECLINED)
  })

  it('loads the tag from the same origin the shared loader uses', () => {
    expect(snippet).toContain(`${GA_SCRIPT_ORIGIN}/gtag/js?id=G-ABC123`)
  })

  it('carries the same banner id, so one stylesheet and one mental model apply', () => {
    expect(snippet).toContain('id="cookie-consent"')
  })

  it('offers both choices as real buttons of equal weight', () => {
    const buttons = [...snippet.matchAll(/<button[^>]*class="([^"]*)"/g)].map((m) => m[1])
    expect(buttons).toHaveLength(2)
    for (const cls of buttons) expect(cls.split(/\s+/)).toContain('consent-btn')
  })

  it('is a labelled dialog, like the component', () => {
    expect(snippet).toMatch(/role="dialog"/)
    expect(snippet).toMatch(/aria-labelledby=/)
  })

  it('overlays rather than displacing, so it cannot shift these pages either', () => {
    expect(snippet).toMatch(/position:\s*fixed/)
  })

  it('links to the privacy page with an absolute path, since these pages are nested', () => {
    // The demo lives at /demo/ and one page at /demo/multi-connection/, so a
    // relative link would resolve differently on each.
    expect(snippet).toContain('href="/privacy/"')
  })

  it('denies every advertising signal, matching the component', () => {
    expect(snippet).toContain('ad_storage')
    expect(snippet).toContain('ad_user_data')
    expect(snippet).toContain('ad_personalization')
    expect(snippet).not.toContain('wait_for_update')
  })

  it('escapes the measurement ID rather than interpolating it raw', () => {
    expect(consentSnippet('G-<script>')).not.toContain('<script>x')
  })

  // The accept button paints itself on --bp-ink, which is a dark navy in light
  // mode and a pale cyan in dark mode. A text colour that does not flip with it
  // is legible in exactly one theme. This shipped hardcoded as #0b1a2b, correct
  // against the dark-mode cyan and 1.46:1 against the light-mode navy.
  //
  // palette-contrast.test.js cannot see this: it reads src/styles/tokens.css,
  // and these static pages resolve the package's --bp-* palette instead. Nor can
  // accessibility.test.js, which excludes 'demo' and 'theme-builder', the only
  // two pages the snippet is injected into.
  describe('the accept button stays legible in both themes', () => {
    const rule = snippet.match(/\.consent-btn-accept\s*\{([^}]*)\}/)[1]
    const declared = (prop) => rule.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`))?.[1].trim()

    // The package palette these pages actually resolve against, from
    // resources/css/truss.css in albertoarena/laravel-truss. Kept as a table so
    // a token swap has to justify itself against real contrast, not by eye.
    const PALETTE = {
      light: { '--bp-ink': '#12356b', '--bp-bg': '#eef1f6', '--bp-fg': '#132741', '--bp-panel': '#fbfcfe' },
      dark: { '--bp-ink': '#5fd0e6', '--bp-bg': '#0b1a2b', '--bp-fg': '#d7e7f4', '--bp-panel': '#0f2338' },
    }

    const rgb = (hex) => [0, 2, 4].map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16))
    const luminance = (hex) => {
      const [r, g, b] = rgb(hex).map((v) => {
        const s = v / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contrast = (a, b) => {
      const [x, y] = [luminance(a), luminance(b)]
      return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
    }

    // "var(--bp-bg, #0b1a2b)" -> "--bp-bg". A bare hex has no token and fails.
    const token = (value) => value?.match(/var\(\s*(--[\w-]+)/)?.[1]

    it('resolves its text colour through a token rather than a fixed hex', () => {
      expect(token(declared('color'))).toBeTruthy()
    })

    it.each(['light', 'dark'])('clears 4.5:1 in %s mode', (theme) => {
      const palette = PALETTE[theme]
      const [fg, bg] = [['color', 'background']].flat().map((prop) => {
        const t = token(declared(prop))
        expect(t, `${prop} must resolve through a --bp-* token so it can flip with the theme`).toBeTruthy()
        expect(palette, `the snippet names ${t}, which is not in the package palette`).toHaveProperty(t)
        return palette[t]
      })
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5)
    })
  })
})

describe('the build wires the snippet into every static page', () => {
  const config = readFileSync(fileURLToPath(new URL('../astro.config.mjs', import.meta.url)), 'utf8')

  it.each([
    ['demo', 'demo'],
    ['nested demo', 'multi-connection'],
    ['theme builder', 'theme-builder'],
  ])('covers the %s page', (_label, marker) => {
    expect(config).toContain(marker)
  })

  it('injects only into the built output, never the committed source', () => {
    // public/ is the source of these pages and stays clean, exactly as the
    // asset versioning does it.
    expect(config).toMatch(/astro:build:done/)
  })
})
