import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

// Structured data has to reach BOTH layout paths, and that is the part a unit
// test cannot prove. This site renders the landing and the roadmap through
// SiteLayout.astro and everything else through Starlight, and the two share no
// head, so anything added to one alone covers half the site. That trap has
// already cost this repo twice: the font preloads and the consent banner both
// had to be applied in two places.
//
// The demo and the theme builder are excluded for the same reason the
// accessibility tests exclude them: they are hand-authored files copied verbatim
// out of public/ and never pass through either layout.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const EXCLUDED = ['demo', 'theme-builder']

function htmlPages(dir = distRoot) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (EXCLUDED.includes(relative(distRoot, full))) continue
      out.push(...htmlPages(full))
    } else if (entry.endsWith('.html')) {
      out.push(full)
    }
  }
  return out
}

const pages = htmlPages()

function graphOf(file) {
  const html = readFileSync(file, 'utf8')
  const matches = [...html.matchAll(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs)]
  if (matches.length === 0) return { count: 0, nodes: [] }
  return {
    count: matches.length,
    nodes: matches.flatMap((match) => JSON.parse(match[1])['@graph']),
  }
}

const types = (file) => graphOf(file).nodes.map((node) => node['@type'])
const page = (path) => join(distRoot, path)

describe('coverage across both layout paths', () => {
  it('finds pages to check', () => {
    expect(pages.length).toBeGreaterThan(10)
  })

  it('emits structured data on every page, through either layout', () => {
    const missing = pages.filter((file) => graphOf(file).count === 0).map((f) => relative(distRoot, f))
    expect(missing).toEqual([])
  })

  it('emits exactly one graph per page, never two competing ones', () => {
    const doubled = pages.filter((file) => graphOf(file).count > 1).map((f) => relative(distRoot, f))
    expect(doubled).toEqual([])
  })

  it('parses as JSON everywhere', () => {
    for (const file of pages) {
      expect(() => graphOf(file)).not.toThrow()
    }
  })
})

describe('the landing page', () => {
  it('describes the package, the site and the author', () => {
    expect(types(page('index.html'))).toEqual(
      expect.arrayContaining(['Person', 'WebSite', 'SoftwareApplication']),
    )
  })
})

describe('a documentation page', () => {
  const docs = page('getting-started/installation/index.html')

  it('describes itself as a technical article with a breadcrumb', () => {
    expect(types(docs)).toEqual(expect.arrayContaining(['TechArticle', 'BreadcrumbList']))
  })

  it('carries the site and author nodes its references depend on', () => {
    expect(types(docs)).toEqual(expect.arrayContaining(['Person', 'WebSite']))
  })

  it('uses the real page title and description, not the site defaults', () => {
    const article = graphOf(docs).nodes.find((node) => node['@type'] === 'TechArticle')
    expect(article.headline).toBe('Installation')
    expect(article.description).toBe('Install Laravel Truss into your application')
    expect(article.url).toBe('https://trussphp.com/getting-started/installation/')
  })
})

describe('references resolve', () => {
  it('never points at an @id that is not defined on the same page', () => {
    // A dangling reference is the failure mode of the @id approach: the markup
    // stays valid JSON and validators stay quiet, while the graph says nothing.
    const dangling = []

    for (const file of pages) {
      const { nodes } = graphOf(file)
      const defined = new Set(nodes.map((node) => node['@id']).filter(Boolean))

      const walk = (value) => {
        if (Array.isArray(value)) return value.forEach(walk)
        if (!value || typeof value !== 'object') return
        const keys = Object.keys(value)
        if (keys.length === 1 && keys[0] === '@id' && !defined.has(value['@id'])) {
          dangling.push(`${relative(distRoot, file)} -> ${value['@id']}`)
        }
        Object.values(value).forEach(walk)
      }

      nodes.forEach(walk)
    }

    expect(dangling).toEqual([])
  })
})
