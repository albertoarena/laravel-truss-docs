import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// Freshness is something answer engines weigh, and the site emitted no date at
// all: Starlight's lastUpdated was off and the TechArticle nodes carried no
// dateModified.
//
// The reason this needs real tests rather than a config flag is that the date
// comes from git history. A shallow clone gives every file the same commit, so
// every page reports the deploy date, identically. That is worse than no date:
// a false freshness claim across the whole site, and nothing about it looks
// broken. Hence the distinctness check below.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))

function docsPages(dir = join(distRoot, 'guides'), out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) docsPages(full, out)
    else if (entry === 'index.html') out.push(full)
  }
  return out
}

const pages = docsPages()

const articleOf = (file) => {
  const html = readFileSync(file, 'utf8')
  const match = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)
  return JSON.parse(match[1])['@graph'].find((node) => node['@type'] === 'TechArticle')
}

describe('dateModified', () => {
  it('has docs pages to check', () => {
    expect(pages.length).toBeGreaterThan(5)
  })

  it('is present on every documentation page', () => {
    const missing = pages.filter((file) => !articleOf(file).dateModified).map((f) => relative(distRoot, f))
    expect(missing).toEqual([])
  })

  it('is a valid ISO 8601 instant', () => {
    for (const file of pages) {
      const value = articleOf(file).dateModified
      expect(value, relative(distRoot, file)).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
      expect(Number.isNaN(Date.parse(value))).toBe(false)
    }
  })

  it('is never in the future', () => {
    for (const file of pages) {
      expect(Date.parse(articleOf(file).dateModified)).toBeLessThanOrEqual(Date.now())
    }
  })

  it('differs between pages, so a shallow clone cannot pass as freshness', () => {
    // With fetch-depth 1 every file resolves to the same commit and every page
    // claims the same modification date. The build succeeds and the output looks
    // plausible, which is precisely why this is asserted.
    const dates = new Set(pages.map((file) => articleOf(file).dateModified))
    expect(
      dates.size,
      'every page reports the same date: the build has no real git history',
    ).toBeGreaterThan(1)
  })
})

describe('what the page shows and what it claims', () => {
  it('shows a last-updated date to the reader', () => {
    const html = readFileSync(join(distRoot, 'guides/authorization/index.html'), 'utf8')
    expect(html).toMatch(/Last updated/i)
  })

  it('shows the same day it puts in the markup', () => {
    // A visible date that disagrees with the structured data is the same class
    // of fault as an FAQ answer that does not match its markup.
    const file = join(distRoot, 'guides/authorization/index.html')
    const html = readFileSync(file, 'utf8')
    const claimed = new Date(articleOf(file).dateModified)

    const shown = html.match(/<time[^>]*datetime="([^"]+)"/)
    expect(shown, 'no <time> element carrying the visible date').not.toBeNull()
    expect(new Date(shown[1]).toDateString()).toBe(claimed.toDateString())
  })
})
