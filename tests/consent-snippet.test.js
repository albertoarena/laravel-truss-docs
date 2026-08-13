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
