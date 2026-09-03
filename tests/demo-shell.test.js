import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { DEMO_APPS, appPageFile, APP_ASSET_TOKEN } from '../scripts/demo-apps.mjs'
import { navLinks, PANEL_ROW_CEILING, MENU_BREAKPOINT, MENU_PAGES } from '../scripts/demo-nav.mjs'

// The two demo pages are hand-authored shells around the package's ACTUAL
// shipped frontend: scripts/copy-demo-assets.mjs fetches resources/ from the
// latest package release, but the markup those assets bind to lives here and is
// maintained by hand. Nothing has ever checked that the two agree.
//
// That drift is not hypothetical. v1.9.0 replaced the Focus <select> with an
// ARIA combobox, and truss.js wires it only when both the input and its listbox
// are present (`if (el.focus && el.focusList)`), so the old markup does not
// throw: the Focus control simply goes dead, on a page whose whole job is to
// show the thing working. These assertions are the tripwire for that class of
// change, on both shells, since the multi-connection variant is easy to forget.
const root = fileURLToPath(new URL('..', import.meta.url))

// The per-application pages are shells too, and the same drift applies to them.
// Derived from the registry rather than listed, so the twentieth application is
// covered by these assertions on the day it is added rather than the day
// somebody remembers this file.
const SHELLS = [
  'public/demo/index.html',
  'public/demo/multi-connection/index.html',
  'public/demo/your-schema/index.html',
  ...DEMO_APPS.map((app) => `public/${appPageFile(app)}`),
].map((path) => ({ path, html: readFileSync(new URL(`../${path}`, import.meta.url), 'utf8') }))

const shell = (name) => SHELLS.find((s) => s.path.includes(name)).html

/** Elements with no closing tag, so an unbalanced-tag check does not chase them. */
const VOID = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr', 'path', 'circle', 'rect', 'use', 'stop',
])

/**
 * Every unclosed or crossed tag in a document, by line.
 *
 * A deliberately small scanner rather than a parser dependency: a browser's
 * parser is forgiving by design and recovers from this silently, which is
 * exactly the problem.
 *
 * Comments and the bodies of <script> and <style> are blanked first, keeping
 * their length so line numbers stay true. Both are raw text to a browser, and
 * treating them as markup produces false alarms: a CSS comment mentioning
 * <html>, or a JS string holding "</div>", is not a tag.
 */
function unbalancedTags(html) {
  const errors = []
  const stack = []
  const lineAt = (index) => html.slice(0, index).split('\n').length
  const blank = (match) => match.replace(/[^\n]/g, ' ')

  const markup = html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_, open, body, close) => open + blank(body) + close)
    .replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, open, body, close) => open + blank(body) + close)

  const tag = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*)>/g

  let match
  while ((match = tag.exec(markup)) !== null) {
    const [whole, closing, name, attrs] = match
    const lower = name.toLowerCase()
    if (VOID.has(lower) || lower === '!doctype' || attrs.trimEnd().endsWith('/')) continue

    if (!closing) {
      stack.push({ name: lower, line: lineAt(match.index) })
      continue
    }

    const open = stack.pop()
    if (!open) errors.push(`stray </${lower}> on line ${lineAt(match.index)}`)
    else if (open.name !== lower) {
      errors.push(`</${lower}> on line ${lineAt(match.index)} closes <${open.name}> opened on line ${open.line}`)
    }
  }

  for (const open of stack) errors.push(`<${open.name}> opened on line ${open.line} is never closed`)

  return errors
}

describe('the shells are structurally valid HTML', () => {
  // This exists because it did not, and a shell shipped with the </a> closing
  // the GitHub link missing. The browser recovered the way browsers do: it
  // nested the whole page inside that anchor, so every line of text rendered
  // underlined and every click navigated to GitHub. Nothing else in this file
  // noticed, because matching strings with a regex cannot see tag structure.
  for (const { path, html } of SHELLS) {
    it(`closes every tag it opens: ${path}`, () => {
      expect(unbalancedTags(html)).toEqual([])
    })
  }

  it('detects the exact failure it was written for', () => {
    // Guarding the guard: a check for structural damage is worthless if it
    // cannot fail.
    const broken = '<header><nav><a href="#"><svg><path d="M0 0"/></svg></nav></header>'

    expect(unbalancedTags(broken)).toContain('</nav> on line 1 closes <a> opened on line 1')
  })

  it('does not mistake raw text in a style or script for markup', () => {
    // Both of these appear in the shells: a CSS comment naming the <html>
    // element, and a script holding a tag in a string.
    const fine = [
      '<head><style>/* set on <html> before load */ html[data-x] { color: red }</style>',
      '<script>var s = "</div>";</script></head>',
    ].join('\n')

    expect(unbalancedTags(fine)).toEqual([])
  })
})

describe('demo shells carry the controls the shipped frontend binds to', () => {
  it('reads every hand-authored shell', () => {
    expect(SHELLS.length).toBe(3 + DEMO_APPS.length)
    for (const { path, html } of SHELLS) {
      expect(html.length, path).toBeGreaterThan(0)
    }
  })

  it('gives Focus the combobox input, not the retired select', () => {
    for (const { path, html } of SHELLS) {
      expect(html, `${path} still has the pre-v1.9 <select>`).not.toMatch(
        /<select[^>]*id="truss-focus"/,
      )
      expect(html, path).toMatch(/<input[^>]*id="truss-focus"[^>]*role="combobox"/s)
    }
  })

  it('gives the combobox its listbox and its live region', () => {
    // Both are required: truss.js skips wiring the picker without the listbox,
    // and the status span is what announces the match count as you type.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/<ul[^>]*id="truss-focus-list"[^>]*role="listbox"/s)
      expect(html, path).toMatch(/id="truss-focus-status"/)
    }
  })

  it('points the combobox at its listbox and starts collapsed', () => {
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/id="truss-focus"[^>]*aria-controls="truss-focus-list"/s)
      expect(html, path).toMatch(/id="truss-focus"[^>]*aria-expanded="false"/s)
    }
  })

  it('labels the combobox with a real label element', () => {
    // The other fields wrap their control in a <label>; a combobox cannot, since
    // the listbox would sit inside the label too, so it needs an explicit for=.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/<label[^>]*for="truss-focus"/)
    }
  })

  it('gives the zoom slider an accessible name', () => {
    // A title attribute is a tooltip, not a name (WCAG 4.1.2). The package
    // fixed this in v1.9.0; the shells carry their own copy of the control.
    for (const { path, html } of SHELLS) {
      expect(html, path).toMatch(/id="truss-zoom-range"[^>]*aria-label="Zoom"/s)
    }
  })
})

describe('the paste shell', () => {
  const paste = shell('your-schema')

  it('is the only shell carrying the paste form', () => {
    // Not a style preference. loadSchema() appends ?connection= to its endpoint
    // when connections are declared, and a blob: URL cannot serve that, so the
    // paste flow and a connection picker cannot live on the same page. Keeping
    // the form off the other two shells is what makes that impossible rather
    // than merely avoided.
    expect(paste).toMatch(/id="paste-input"/)
    for (const { path, html } of SHELLS) {
      if (path.includes('your-schema')) continue
      expect(html, `${path} carries the paste form`).not.toMatch(/id="paste-input"/)
    }
  })

  it('declares no connections, so nothing can be appended to a blob endpoint', () => {
    expect(paste).toMatch(/data-connections='\[\]'/)
  })

  it('ships with no schema endpoint, since there is no schema until one is pasted', () => {
    // The attribute, not the word: the shell explains in a comment why it is
    // absent, and that explanation is worth more than a looser assertion.
    expect(paste).not.toMatch(/data-schema-endpoint\s*=/)
  })

  it('hides the dashboard until a schema is drawn', () => {
    expect(paste).toMatch(/hidden\s+id="truss-app"/)
  })

  it('loads no dashboard module of its own, and hands ui.js the versioned URL', () => {
    // The build stamps a version onto the asset folder by rewriting ../assets/
    // in the page HTML and never in JavaScript, so the URL has to be declared
    // here or the import 404s in production while working locally.
    expect(paste).not.toMatch(/<script type="module" src="\.\.\/assets\/truss\.js"/)
    expect(paste).toMatch(/data-truss-module="\.\.\/assets\/truss\.js"/)
  })

  it('says on the page itself that nothing is uploaded', () => {
    expect(paste).toMatch(/nothing is uploaded/i)
  })
})

describe('demo shells preload the face the diagram is measured in', () => {
  // The dashboard's Blade view preloads this face. These shells never render
  // that view, so the hint has to be repeated here by hand or the demo, which
  // is the page the clipping was reported against, loads without it.
  //
  // The package waits for the face before measuring, so this is not what fixes
  // the clipping. It shortens the wait: without the hint the face is discovered
  // only when truss.css is parsed, and the demo fetches it across the network
  // on a cold visit.
  const PRELOAD = /<link[^>]*rel="preload"[^>]*>/g

  it('preloads the 400 weight, which is what the labels paint in', () => {
    for (const { path, html } of SHELLS) {
      const tags = html.match(PRELOAD) ?? []
      const face = tags.find((tag) => tag.includes('ibm-plex-mono-400.woff2'))
      expect(face, `${path} does not preload the label face`).toBeTruthy()
      expect(face, `${path}: preload needs as="font"`).toMatch(/as="font"/)
      // Required even same-origin, or the preload is fetched again rather than
      // reused, which makes the hint worse than useless.
      expect(face, `${path}: font preloads need crossorigin`).toMatch(/crossorigin/)
    }
  })

  it('points the preload at the relative assets folder the build rewrites', () => {
    // demo-asset-versioning renames assets/ to assets-<version>/ and repoints
    // only the literal tokens it is given for each page. An absolute or
    // differently spelled path survives the rewrite and then 404s, which would
    // preload nothing and warn in the console on every visit.
    //
    // The depth is per page and not a free choice: the top-level demo uses
    // ./assets/, the pages one level down use ../assets/, and the
    // per-application pages two levels down use ../../assets/, which is the
    // token astro.config.mjs registers for them through APP_ASSET_TOKEN.
    for (const { path, html } of SHELLS) {
      const face = (html.match(PRELOAD) ?? []).find((tag) => tag.includes('ibm-plex-mono-400.woff2'))
      const expected = path.includes('/demo/apps/')
        ? `href="${APP_ASSET_TOKEN}ibm-plex-mono-400.woff2"`
        : /href="\.{1,2}\/assets\/ibm-plex-mono-400\.woff2"/
      expect(face, path).toMatch(expected)
    }
  })
})

/**
 * The site menu.
 *
 * Below 720px these shells used to drop every text link and put nothing in its
 * place: `@media (max-width: 560px) { .site-bar-nav a { display: none } }`, in
 * all four files. What survived was the GitHub link, and only because
 * `.site-bar-nav a.gh` (0,2,1) outranks `.site-bar-nav a` (0,1,1), which is an
 * accident rather than a decision. A reader arriving on a phone could read the
 * diagram and then had nowhere to go: no Docs, no Roadmap, no other demo, and
 * no menu, on pages whose body cannot scroll.
 *
 * The rule these assertions hold: links may be collapsed, never removed, and
 * the controls that live in the bar stay in the bar.
 */
describe('the site menu', () => {
  /** 'public/demo/apps/lunar/index.html' -> '/demo/apps/lunar/'. */
  const sitePath = (path) => path.replace(/^public/, '').replace(/index\.html$/, '')

  /**
   * Every page carrying the site bar, which is the four dashboard shells above
   * plus the theme builder. SHELLS is about pages that render the dashboard, so
   * it is the wrong list for a menu that also belongs to a page that does not.
   */
  const BARS = MENU_PAGES.map((path) => {
    const file = `public${path}index.html`
    return { path: file, html: readFileSync(new URL(`../${file}`, import.meta.url), 'utf8') }
  })

  /**
   * The file with its comments removed.
   *
   * Written because this assertion caught its own prose: a comment quoting the
   * rule that was deleted reads exactly like the rule. A test that a sentence
   * can trip is weak in both directions, since a real rule inside a commented
   * block would equally have been believed.
   */
  const code = (html) => html.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')

  const nav = (html) => html.match(/<nav class="site-bar-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] ?? ''
  const actions = (html) => html.match(/<div class="site-bar-actions">([\s\S]*?)<\/div>/)?.[1] ?? ''
  const hrefs = (fragment) => [...fragment.matchAll(/<a[^>]*href="([^"]+)"/g)].map((m) => m[1])

  it('gives every shell a menu button wired to the nav', () => {
    for (const { path, html } of BARS) {
      const btn = html.match(/<button[^>]*class="site-bar-menu-btn"[^>]*>/)?.[0]

      expect(btn, `${path}: no menu button`).toBeTruthy()
      expect(btn, `${path}: the button must start collapsed`).toMatch(/aria-expanded="false"/)
      expect(btn, `${path}: the button must point at the nav it opens`).toMatch(/aria-controls="site-menu"/)
      expect(btn, `${path}: an icon-only button needs an accessible name`).toMatch(/aria-label="[^"]+"/)
      expect(html.match(/class="site-bar-menu-btn"/g).length, `${path}: more than one menu button`).toBe(1)
    }
  })

  it('gives the nav the id the button controls', () => {
    for (const { path, html } of BARS) {
      const tag = html.match(/<nav class="site-bar-nav"[^>]*>/)?.[0]

      expect(tag, `${path}: no site nav`).toBeTruthy()
      expect(tag, `${path}: aria-controls resolves to nothing`).toMatch(/id="site-menu"/)
      expect(tag, `${path}: the nav lost its landmark label`).toMatch(/aria-label="Site"/)
    }
  })

  it('links to every other demo and to the rest of the site, in one order', () => {
    // The four lists had already drifted before the menu existed: two shells
    // offered Theme builder and two did not, and neither app-adjacent shell
    // linked to the multi-connection page. Deriving from the registry means the
    // second application fails this until every shell links to it.
    for (const { path, html } of BARS) {
      const expected = navLinks(sitePath(path)).map((link) => link.path)

      expect(hrefs(nav(html)), `${path}: the nav is not the canonical set`).toEqual(expected)
    }
  })

  it('never links a shell to itself', () => {
    for (const { path, html } of BARS) {
      expect(hrefs(nav(html)), path).not.toContain(sitePath(path))
    }
  })

  it('keeps the bar controls in the bar', () => {
    // Decision 2: GitHub is one tap today and stays one tap, which it cannot be
    // from inside a panel. The theme toggle changes what you are looking at
    // rather than taking you somewhere, so it is not navigation either. Both
    // live in .site-bar-actions, and the accident that used to keep GitHub
    // visible is replaced by a rule.
    for (const { path, html } of BARS) {
      expect(actions(html), `${path}: GitHub is not a bar control`).toMatch(/class="gh"/)
      expect(nav(html), `${path}: GitHub is back inside the nav`).not.toMatch(/class="gh"/)
      // The theme builder has no theme toggle of its own: it previews themes,
      // so a control cycling the page's own theme would be two things at once.
      if (!html.includes('site-bar-theme')) continue
      expect(actions(html), `${path}: the theme toggle is not a bar control`).toMatch(/site-bar-theme/)
      expect(nav(html), `${path}: the theme toggle is inside the nav`).not.toMatch(/site-bar-theme/)
    }
  })

  it('hides no link without offering the menu instead', () => {
    // The bug itself, in its structural form. A rule that hides the links
    // outright is the defect whatever width it is scoped to.
    for (const { path, html } of BARS) {
      const hides = code(html).match(/\.site-bar-nav a[^{]*\{[^}]*display:\s*none[^}]*\}/g) ?? []

      expect(hides, `${path}: ${hides.join(' ')}`).toEqual([])
    }
  })

  it('loads the menu script once, by a path the build can find', () => {
    for (const { path, html } of BARS) {
      const tags = html.match(/<script src="\/demo\/site-menu\.js"><\/script>/g) ?? []

      expect(tags.length, `${path}: expected exactly one menu script tag`).toBe(1)
    }
  })

  it('collapses at the one measured breakpoint, in every shell and in the script', () => {
    // Every failure on these strips has been a number chosen against one item
    // set that later grew: 1400 for the footer, 560 here, and 720 for a moment
    // during this change, until the canonical set made the widest inline bar
    // 1014px and reopened the band one pixel above itself. One number, in one
    // place, checked here.
    const script = readFileSync(new URL('../public/demo/site-menu.js', import.meta.url), 'utf8')

    for (const { path, html } of BARS) {
      expect(code(html), `${path}: the panel is not at MENU_BREAKPOINT`)
        .toContain(`@media (max-width: ${MENU_BREAKPOINT}px)`)
    }
    expect(script, 'the script watches a different breakpoint than the CSS')
      .toContain(`(min-width: ${MENU_BREAKPOINT + 1}px)`)
  })

  it('lets the caption shrink and nothing else', () => {
    // The footer's lesson, applied to the bar. The tag is a sentence describing
    // the page, so it is the one item that may ellipsise; with it rigid, the two
    // shells that carry one need 1190 and 1214px and overflow everything from
    // the breakpoint up to there.
    for (const { path, html } of BARS) {
      if (!html.includes('class="site-bar-tag"')) continue
      const rule = html.match(/\.site-bar-tag \{[^}]*flex:[^}]*\}/s)?.[0] ?? ''

      expect(rule, `${path}: the caption cannot shrink`).toMatch(/flex:\s*0 1 auto/)
      expect(rule, `${path}: shrinking without min-width: 0 does nothing`).toMatch(/min-width:\s*0/)
    }
  })

  it('keeps the panel within the rows a landscape phone can show', () => {
    // 430px tall, less the 48px bar and the panel padding, is about eight rows
    // at a 44px touch target, and the panel cannot scroll: the canvas
    // preventDefaults wheel events. /demo/ is the shell that binds, because it
    // carries the palette row on top of its links. The second application fills
    // it exactly; the third needs the list grouped or truncated first.
    for (const { path, html } of BARS) {
      const rows = hrefs(nav(html)).length + (nav(html).includes('site-bar-palettes') ? 1 : 0)

      expect(rows, `${path}: ${rows} rows, past what a landscape phone shows`)
        .toBeLessThanOrEqual(PANEL_ROW_CEILING)
    }
  })
})
