import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

let landing = ''
let roadmap = ''
// Whitespace-collapsed copies for prose checks (Astro keeps source line breaks
// inside text, so raw substring matches on multi-word phrases are brittle).
let landingText = ''
let roadmapText = ''
const collapse = (s) => s.replace(/\s+/g, ' ')

beforeAll(() => {
  const landingPath = dist('index.html')
  const roadmapPath = dist('roadmap/index.html')
  if (!existsSync(landingPath) || !existsSync(roadmapPath)) {
    throw new Error('dist not built. Run `npm run build` (or astro build) before the page tests.')
  }
  landing = readFileSync(landingPath, 'utf8')
  roadmap = readFileSync(roadmapPath, 'utf8')
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

describe('writing rules in rendered output', () => {
  it('ships no em or en dashes on the landing or roadmap', () => {
    expect(landing.match(/[—–]/g) ?? [], 'landing').toEqual([])
    expect(roadmap.match(/[—–]/g) ?? [], 'roadmap').toEqual([])
  })
})
