import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

let landing = ''
let roadmap = ''
let docsPage = ''
// Whitespace-collapsed copies for prose checks (Astro keeps source line breaks
// inside text, so raw substring matches on multi-word phrases are brittle).
let landingText = ''
let roadmapText = ''
const collapse = (s) => s.replace(/\s+/g, ' ')

beforeAll(() => {
  const landingPath = dist('index.html')
  const roadmapPath = dist('roadmap/index.html')
  // A Starlight docs page: it uses the Footer override, not the SiteLayout footer.
  const docsPath = dist('getting-started/installation/index.html')
  if (!existsSync(landingPath) || !existsSync(roadmapPath) || !existsSync(docsPath)) {
    throw new Error('dist not built. Run `npm run build` (or astro build) before the page tests.')
  }
  landing = readFileSync(landingPath, 'utf8')
  roadmap = readFileSync(roadmapPath, 'utf8')
  docsPage = readFileSync(docsPath, 'utf8')
  landingText = collapse(landing)
  roadmapText = collapse(roadmap)
})

describe('landing page output', () => {
  it('leads with the headline and the install command', () => {
    expect(landing).toContain('See your database')
    expect(landing).toContain('composer require albertoarena/laravel-truss')
  })
  it('renders the static ER product band and the chord wordmark', () => {
    expect(landing).toContain('viewBox="0 0 780 210"')
    expect(landingText).toContain('companies, users and posts tables')
    expect(landing).toContain('wm-chord')
  })
  it('uses a sequential heading order with no skipped levels (a11y)', () => {
    // Lighthouse flags "heading elements not in sequentially-descending order".
    // The hand-authored landing owns its own hierarchy (Starlight does not), so
    // guard it: start at h1 and never jump more than one level down.
    const levels = [...landing.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]))
    expect(levels.length, 'landing has headings').toBeGreaterThan(0)
    expect(levels[0], 'first heading is the h1').toBe(1)
    for (let i = 1; i < levels.length; i++) {
      expect(
        levels[i] - levels[i - 1],
        `heading order skips a level: h${levels[i - 1]} then h${levels[i]}`,
      ).toBeLessThanOrEqual(1)
    }
  })
  it('self-hosts IBM Plex Mono rather than a CDN font', () => {
    expect(landing).toContain('/fonts/ibm-plex-mono-')
    expect(landing).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/)
  })
  it('shares the theme with Starlight via the starlight-theme key', () => {
    expect(landing).toContain('starlight-theme')
  })
})

describe('roadmap page output', () => {
  it('renders all four curated sections', () => {
    for (const label of ['Shipped', 'Approved next', 'Exploring', 'Nice to have']) {
      expect(roadmap, label).toContain(label)
    }
  })
  it('shows a committed next item and the community-requested wishlist item', () => {
    expect(roadmap).toContain('Schema diff')
    expect(roadmap).toContain('community requested')
    expect(roadmap).toContain('/issues/2')
  })
  it('carries the non-binding disclaimer and the soft sponsor tie-in', () => {
    expect(roadmapText).toMatch(/not a promise/i)
    expect(roadmap).toContain('ko-fi.com/albertoarena')
  })
})

describe('site footer', () => {
  // The site has two footers that must stay in step: SiteLayout (hand-authored
  // pages) and the Starlight Footer override (docs pages).
  const playlist = 'youtube.com/playlist?list=PLdadt28gT2Qc'

  it('links the "Truss in the Wild" playlist from every footer', () => {
    for (const [label, html] of [
      ['landing', landing],
      ['roadmap', roadmap],
      ['docs page', docsPage],
    ]) {
      expect(html, label).toContain(playlist)
      expect(html, label).toContain('>Videos<')
    }
  })

  it('points at the playlist rather than the channel root', () => {
    expect(landing).not.toContain('youtube.com/@AlbertoArenaDev')
    expect(docsPage).not.toContain('youtube.com/@AlbertoArenaDev')
  })
})

describe('writing rules in rendered output', () => {
  it('ships no em or en dashes on the landing or roadmap', () => {
    expect(landing.match(/[—–]/g) ?? [], 'landing').toEqual([])
    expect(roadmap.match(/[—–]/g) ?? [], 'roadmap').toEqual([])
  })
})
