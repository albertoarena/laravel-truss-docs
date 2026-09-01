import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// Structural accessibility guards over the built output.
//
// Scope note: these assert what static HTML can prove (landmarks, link
// structure, skip links). Contrast and reflow are computed from CSS at render
// time and cannot be checked here; those belong to Lighthouse CI and to the
// manual pass. A green run of this file is a floor, not a conformance claim.
//
// The demo and the theme builder are excluded on purpose: they embed the
// package's shipped frontend, which is fetched from the latest package release
// at build time, so their accessibility is the package's to fix and auditing a
// release that is about to be replaced measures nothing.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const EXCLUDED = ['demo', 'theme-builder']

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED.includes(relative(distRoot, full))) continue
      out.push(...walk(full))
    } else if (entry.name.endsWith('.html')) {
      out.push(full)
    }
  }
  return out
}

/**
 * Hand-authored pages (SiteLayout), as opposed to Starlight-generated ones.
 *
 * Enumerated rather than discovered, so a new one is simply absent from the
 * checks below until it is added here: no red test, just assertions that quietly
 * stop applying. Add the page when you add the route.
 */
const CUSTOM_PAGES = ['index.html', 'roadmap/index.html', 'in-the-wild/index.html']

let pages = []

beforeAll(() => {
  if (!existsSync(distRoot)) {
    throw new Error('dist not built. Run `npm run build` before the accessibility tests.')
  }
  pages = walk(distRoot).map((path) => ({
    name: relative(distRoot, path),
    html: readFileSync(path, 'utf8'),
  }))
  expect(pages.length, 'dist contains pages to audit').toBeGreaterThan(5)
})

describe('links', () => {
  // How much visible text between two links still counts as "next to each
  // other". WAVE flags any two consecutive anchors sharing an href, however far
  // apart they are in the document, which over-reports: a guide that links the
  // same page from two different sections is not a redundant link, it is a
  // cross-reference, and merging those would make the prose worse. What actually
  // costs a screen reader user is hearing the same destination twice with
  // nothing in between, so measure the gap rather than the index.
  const ADJACENT_WITHIN_CHARS = 120

  it('never places two links to the same URL next to each other', () => {
    // The docs header used to render the wordmark link to "/" immediately
    // followed by a "Home" nav link to "/", on every docs page: two links, one
    // destination, no words between them.
    const offenders = []
    for (const { name, html } of pages) {
      const anchors = [...html.matchAll(/<a\s[^>]*href="([^"]*)"/g)]
      for (let i = 0; i < anchors.length - 1; i++) {
        if (anchors[i][1] !== anchors[i + 1][1]) continue
        const between = html.slice(anchors[i].index, anchors[i + 1].index)
        const text = between
          // Inline script and style bodies are not tags, so tag-stripping alone
          // leaves them in and a single inline script reads as hundreds of
          // characters of "content" between two links that are visually side by
          // side. The docs header has exactly that shape.
          .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
        if (text.length < ADJACENT_WITHIN_CHARS) {
          offenders.push(`${name}: ${anchors[i][1]} (${text.length} chars between)`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('bypass blocks', () => {
  // WCAG 2.4.1, Level A. Starlight emits a skip link on the docs pages; the
  // hand-authored pages own their own shell, so nothing generated one for them
  // and every visit began by tabbing through the whole header.
  it.each(CUSTOM_PAGES)('%s opens with a skip link into main', (page) => {
    const html = pages.find((p) => p.name === page)?.html
    expect(html, `${page} is in dist`).toBeTruthy()

    expect(html, 'has a skip link').toMatch(/<a[^>]+class="[^"]*skip[^"]*"[^>]+href="#main"/)
    expect(html, 'has the target it points at').toMatch(/<main[^>]+id="main"/)

    // It has to come before the header, or it does not bypass anything.
    expect(html.indexOf('href="#main"')).toBeLessThan(html.indexOf('<header'))
  })
})

describe('wide tables', () => {
  // WCAG 1.4.10 Reflow. At a 320px viewport the reference tables measure about
  // 327px inside a 288px column, and their parent is `overflow-x: visible` with
  // nothing to scroll, so roughly 39px of the last column is unreachable: the
  // content is lost, not merely awkward. A scrollable wrapper fixes that, but a
  // scrollable region that only a mouse can reach trades 1.4.10 for 2.1.1, so
  // it has to be focusable and named too.
  it('wraps every content table in a keyboard-reachable scroll region', () => {
    const offenders = []
    for (const { name, html } of pages) {
      for (const match of html.matchAll(/<table[\s>]/g)) {
        const before = html.slice(Math.max(0, match.index - 300), match.index)
        const wrapper = before.lastIndexOf('<div')
        const opens = wrapper === -1 ? '' : before.slice(wrapper)
        if (!/class="[^"]*table-scroll/.test(opens)) offenders.push(`${name}: unwrapped table`)
        else if (!/tabindex="0"/.test(opens)) offenders.push(`${name}: wrapper not focusable`)
        else if (!/aria-label="/.test(opens)) offenders.push(`${name}: wrapper unnamed`)
      }
    }
    expect([...new Set(offenders)]).toEqual([])
  })
})

describe('the copy button', () => {
  it('announces the result instead of only showing it', () => {
    // WCAG 4.1.3 Status Messages. The button swaps its visible text to
    // "copied", but it carries an aria-label, and a label wins over text
    // content, so the accessible name never changes and a screen reader user
    // gets no confirmation that anything happened at all.
    const landing = pages.find((p) => p.name === 'index.html').html
    expect(landing, 'a polite live region exists').toMatch(/aria-live="polite"/)
    expect(landing, 'the copy script writes to it').toMatch(/copy-status/)
  })

  it('says so when copying fails instead of going silent', () => {
    // The clipboard write can be refused (permission, an insecure context, or
    // no Clipboard API at all). The original had no rejection path and called
    // .then on a possibly-undefined value, so a refusal produced nothing: no
    // "copied", no error, a button that visibly did nothing. Silence is the
    // worst answer for a status message, and worse still for anyone who cannot
    // see that the label failed to change.
    const landing = pages.find((p) => p.name === 'index.html').html
    expect(landing, 'a rejection path exists').toMatch(/catch\(/)
    expect(landing, 'it tells the user what to do instead').toMatch(/copy it manually/)
  })
})

describe('the version pill', () => {
  it('separates its items without low-contrast text characters', () => {
    // The separators were `<span class="dot">.</span>` painted in the hairline
    // colour, which measured 1.5:1 against the pill background in light and
    // 1.73:1 in dark. As real text they also read out between every item.
    // Drawing them in CSS makes them decoration, which is both accessible and
    // silent.
    const landing = pages.find((p) => p.name === 'index.html').html
    const at = landing.indexOf('class="badge')
    expect(at, 'the badge is in the output').toBeGreaterThan(-1)
    // A window rather than a matched element: the pill is a flat run of inline
    // children, so there is no single closing tag to anchor on.
    const pill = landing.slice(at, at + 400)

    expect(pill, 'no separator spans').not.toMatch(/class="dot[\s"]/)
    expect(pill, 'no middle-dot separators as text').not.toContain('·')
  })
})
