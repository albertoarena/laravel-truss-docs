import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// Which hosts the built pages REQUEST, as opposed to link to.
//
// /privacy/ enumerates the third parties this site contacts, and makes one
// promise in absolute terms: "Nothing belonging to Google is loaded until you
// press Accept. Not the script, not a cookieless ping, nothing." It also draws
// the distinction this file encodes: "The documentation links out to places like
// GitHub, Packagist, YouTube and Ko-fi. Those are ordinary links: nothing is
// requested from them until you click."
//
// So an <a href> is fine and a <script src>, <iframe src>, <img src> or
// stylesheet is a privacy change. Adding one means the privacy page is now
// wrong until it is updated, and nothing in the build would have said so. A
// YouTube embed on /in-the-wild/ was proposed and would have shipped exactly
// that: an editorial decision with a privacy consequence nobody was looking for.
//
// This is the check that would have caught it. The video ended up as a plain
// link for unrelated reasons, which is the cheapest possible answer, but the
// test stays: the next embed will be proposed by somebody who has not read any
// of this.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))

/**
 * Hosts the built output may request without a click.
 *
 * Adding one is a deliberate act: update src/content/docs/privacy.mdx in the
 * same change, or the site is making a claim it no longer honours.
 */
const ALLOWED = ['trussphp.com', 'static.cloudflareinsights.com']

// The demo and the theme builder embed the package's shipped frontend, fetched
// from the latest release at build time. Their contents are the package's to
// answer for, matching how accessibility.test.js scopes itself.
const EXCLUDED = ['demo', 'theme-builder']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (EXCLUDED.includes(relative(distRoot, full))) continue
      walk(full, out)
    } else if (entry.name.endsWith('.html')) out.push(full)
  }
  return out
}

/** src= and href= on elements that fetch. Deliberately not <a href>. */
const FETCHING = /<(?:script|iframe|img|source|video|audio|embed|track)\b[^>]*\bsrc="(https?:\/\/[^"]+)"/gi
const LINKED_RESOURCE = /<link\b[^>]*\bhref="(https?:\/\/[^"]+)"/gi

let pages = []

beforeAll(() => {
  pages = walk(distRoot).map((path) => ({
    name: relative(distRoot, path),
    html: readFileSync(path, 'utf8'),
  }))
  expect(pages.length, 'dist contains pages to audit').toBeGreaterThan(5)
})

const hostsIn = (html) => {
  const found = []
  for (const pattern of [FETCHING, LINKED_RESOURCE]) {
    pattern.lastIndex = 0
    for (const match of html.matchAll(pattern)) found.push(new URL(match[1]).hostname)
  }
  return found
}

describe('third-party origins in the built output', () => {
  it('requests nothing from a host the privacy page does not declare', () => {
    const offenders = []
    for (const { name, html } of pages) {
      for (const host of hostsIn(html)) {
        if (!ALLOWED.includes(host.replace(/^www\./, ''))) offenders.push(`${name}: ${host}`)
      }
    }

    expect([...new Set(offenders)]).toEqual([])
  })

  it('contacts Google from nowhere before a click', () => {
    // The specific promise, asserted specifically, because it is the one the
    // privacy page makes without a caveat.
    for (const { name, html } of pages) {
      for (const host of hostsIn(html)) {
        expect(host, `${name} requests ${host}`).not.toMatch(
          /google|youtube|ytimg|gstatic|doubleclick/i,
        )
      }
    }
  })

  it('still lets pages link out, since a link requests nothing', () => {
    // Guards the distinction rather than the list: if this ever fails, the
    // patterns above have started matching anchors and the test has quietly
    // become a link policy instead of a privacy one.
    const inTheWild = pages.find((p) => p.name === 'in-the-wild/index.html')
    expect(inTheWild.html, 'links to the sources it quotes').toMatch(
      /<a[^>]+href="https:\/\/www\.linkedin\.com/,
    )
    expect(inTheWild.html, 'links to the video it cites').toMatch(
      /<a[^>]+href="https:\/\/www\.youtube\.com\/watch/,
    )
  })
})
