import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

let landing = ''
let roadmap = ''
let inTheWild = ''
let docsPage = ''
let notFound = ''
// Whitespace-collapsed copies for prose checks (Astro keeps source line breaks
// inside text, so raw substring matches on multi-word phrases are brittle).
let landingText = ''
let roadmapText = ''
const collapse = (s) => s.replace(/\s+/g, ' ')

beforeAll(() => {
  const landingPath = dist('index.html')
  const roadmapPath = dist('roadmap/index.html')
  const inTheWildPath = dist('in-the-wild/index.html')
  // A Starlight docs page: it uses the Footer override, not the SiteLayout footer.
  const docsPath = dist('getting-started/installation/index.html')
  // The 404 renders through Starlight with no sidebar, so it has no mobile menu
  // of its own: whatever its footer carries is the whole of its navigation on a
  // phone. That makes it the page where a missing footer link actually strands
  // somebody, which is why it is read here rather than assumed to match docs.
  const notFoundPath = dist('404.html')
  for (const path of [landingPath, roadmapPath, inTheWildPath, docsPath, notFoundPath]) {
    if (!existsSync(path)) {
      throw new Error('dist not built. Run `npm run build` (or astro build) before the page tests.')
    }
  }
  landing = readFileSync(landingPath, 'utf8')
  roadmap = readFileSync(roadmapPath, 'utf8')
  inTheWild = readFileSync(inTheWildPath, 'utf8')
  docsPage = readFileSync(docsPath, 'utf8')
  notFound = readFileSync(notFoundPath, 'utf8')
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

describe('site header', () => {
  // The site has two headers: SiteLayout for the hand-authored pages and the
  // Starlight Header override for the docs. Keeping them in step is the whole
  // reason that override exists, and a nav entry added to one is invisible from
  // the other half of the site. That is how /in-the-wild/ could ship linked
  // from the landing page and unreachable from every guide.
  const DESTINATIONS = ['/roadmap/', '/in-the-wild/', '/demo/']

  /**
   * Just the site nav, not the whole page.
   *
   * Scoping matters more than it looks. Asserting against the full HTML passed
   * with the link deleted from the Starlight header, because the docs sidebar
   * links the same page and the substring was still there. The test would have
   * reported a header that agreed while the two disagreed.
   */
  const siteNav = (html) => {
    const match = html.match(/<nav[^>]*class="[^"]*(?:top-nav|site-nav)[^"]*"[\s\S]*?<\/nav>/)
    return match ? match[0] : ''
  }

  it('offers the same destinations from both headers', () => {
    for (const [label, html] of [
      ['landing (SiteLayout)', landing],
      ['roadmap (SiteLayout)', roadmap],
      ['in the wild (SiteLayout)', inTheWild],
      ['docs page (Starlight override)', docsPage],
    ]) {
      const nav = siteNav(html)
      expect(nav, `${label} has a site nav`).toBeTruthy()

      for (const href of DESTINATIONS) {
        expect(nav, `${label} nav links ${href}`).toContain(`href="${href}"`)
      }
    }
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
      ['in the wild', inTheWild],
      ['docs page', docsPage],
    ]) {
      expect(html, label).toContain(playlist)
      expect(html, label).toContain('>Videos<')
    }
  })

  it('reaches the live demo from every footer', () => {
    // Below 720px SiteLayout hides its header nav, and below 800px the Starlight
    // header hides its right group, so on a phone the footer IS the navigation
    // on these pages. Neither footer linked the demo, so from the landing page,
    // the roadmap, in-the-wild or a 404, a phone reader could not reach the one
    // thing the site is for. Docs pages were the exception, by way of the
    // sidebar, which is why this went unnoticed.
    const footerNav = (html) => html.match(/<nav[^>]*class="[^"]*footer-nav[^"]*"[\s\S]*?<\/nav>/)?.[0] ?? ''

    for (const [label, html] of [
      ['landing', landing],
      ['roadmap', roadmap],
      ['in the wild', inTheWild],
      ['docs page', docsPage],
      ['404', notFound],
    ]) {
      const nav = footerNav(html)
      expect(nav, `${label} has a footer nav`).toBeTruthy()
      expect(nav, `${label} footer links the demo`).toContain('href="/demo/"')
      expect(nav, `${label} footer links the paste-your-own page`).toContain('href="/demo/your-schema/"')
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

  // In the wild is the one page that renders other people's words, and other
  // people use em dashes. The rule still applies to everything we wrote on it,
  // so the quoted elements come out and the rest is checked: strip the page and
  // it would be the only hand-authored surface with no style rule at all, which
  // is the silent gap this repo keeps getting bitten by.
  //
  // The stripped unit is whatever carries verbatim text: the blockquote holds the
  // quote, the cite and the role sit in the attribution footer beside it, and the
  // ld+json in the head carries the same quotes again in machine-readable form.
  // Missing that third one would have passed here and still shipped somebody's
  // punctuation into the page, which is the failure this check exists to catch.
  //
  // Matched on the class token rather than the whole attribute because Astro
  // appends a scoped class to every element it renders, so class="who" never
  // appears literally in the output. Source-side, the same carve-out lives in
  // content-rules.test.js.
  const withoutQuoted = (html) =>
    html
      .replace(/<blockquote[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<footer[^>]*class="[^"]*\bwho\b[^"]*"[\s\S]*?<\/footer>/gi, '')
      .replace(/<script[^>]*application\/ld\+json[\s\S]*?<\/script>/gi, '')

  it('ships no em or en dashes of our own on in the wild', () => {
    expect(withoutQuoted(inTheWild).match(/[—–]/g) ?? [], 'in the wild, minus quotes').toEqual([])
  })

  it('strips only the quoted parts, so the rest of that page stays covered', () => {
    // Guards the carve-out itself. Without this, "strip the quotes" quietly
    // becomes "skip the page" the first time somebody widens the regex.
    const sample =
      '<h1>Ours — wrong</h1><blockquote lang="pt-BR"><p>Theirs — fine</p></blockquote>' +
      '<footer class="who astro-x"><cite>Name</cite><span class="role">A — B</span></footer>' +
      '<script type="application/ld+json">{"text":"Machine — copy"}</script>'

    expect(withoutQuoted(sample)).toContain('Ours — wrong')
    expect(withoutQuoted(sample)).not.toContain('Theirs')
    expect(withoutQuoted(sample)).not.toContain('A — B')
    expect(withoutQuoted(sample)).not.toContain('Machine')
  })
})
