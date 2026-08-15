import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// The guard the unit tests could not give. They fed clean ids and passed while
// the real build produced /guides/theming.mdx/, because Starlight's collection
// ids keep the source extension. Every link in the shipped file was a 404 and
// nothing said so.
//
// So this asserts the generated file against the routes that were actually
// built, which is the only check that can catch a mismatch between the two.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const read = (name) => readFileSync(join(distRoot, name), 'utf8')

const SITE = 'https://trussphp.com'

/** Every directory in dist that contains an index.html, as a site path. */
function builtRoutes(dir = distRoot, routes = new Set()) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      builtRoutes(full, routes)
    } else if (entry === 'index.html') {
      const rel = relative(distRoot, dir)
      routes.add(rel === '' ? '/' : `/${rel}/`)
    }
  }
  return routes
}

const routes = builtRoutes()
const linkedUrls = (text) => [...text.matchAll(/\]\((https:\/\/[^)]+)\)/g)].map((match) => match[1])

describe('llms.txt', () => {
  it('is built', () => {
    expect(existsSync(join(distRoot, 'llms.txt'))).toBe(true)
  })

  it('links only pages that were actually built', () => {
    const broken = linkedUrls(read('llms.txt'))
      .filter((url) => url.startsWith(SITE))
      .filter((url) => !routes.has(url.slice(SITE.length)))

    expect(broken).toEqual([])
  })

  it('indexes every documentation page, so a new one cannot be forgotten', () => {
    const linked = new Set(
      linkedUrls(read('llms.txt'))
        .filter((url) => url.startsWith(SITE))
        .map((url) => url.slice(SITE.length)),
    )

    // Every built docs route should appear. The landing, the roadmap and the
    // 404 are not part of the documentation collection and are not expected.
    const notIndexed = [...routes].filter(
      (route) => route !== '/' && route !== '/roadmap/' && !linked.has(route),
    )

    expect(notIndexed).toEqual([])
  })

  it('opens with one H1 and a blockquote, as the format requires', () => {
    const lines = read('llms.txt').split('\n')
    expect(lines[0]).toBe('# Laravel Truss')
    expect(lines[2].startsWith('> ')).toBe(true)
  })
})

describe('llms-full.txt', () => {
  it('is built', () => {
    expect(existsSync(join(distRoot, 'llms-full.txt'))).toBe(true)
  })

  it('carries real page bodies, not just an index', () => {
    const text = read('llms-full.txt')
    // Something only present in the prose of a specific page.
    expect(text).toContain('composer require albertoarena/laravel-truss')
    expect(text.length).toBeGreaterThan(read('llms.txt').length * 5)
  })

  it('attributes every page to a route that exists', () => {
    const sources = [...read('llms-full.txt').matchAll(/^Source: (\S+)$/gm)].map((m) => m[1])
    expect(sources.length).toBeGreaterThan(5)

    const broken = sources.filter((url) => !routes.has(url.slice(SITE.length)))
    expect(broken).toEqual([])
  })

  it('leaves out the secondary pages rather than padding the context', () => {
    const sources = [...read('llms-full.txt').matchAll(/^Source: (\S+)$/gm)].map((m) => m[1])
    expect(sources).not.toContain(`${SITE}/privacy/`)
    expect(sources).not.toContain(`${SITE}/credits/`)
  })
})
