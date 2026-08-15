import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { FAQ } from '../src/data/faq.ts'

// Google's rule for FAQPage is that the marked-up content must be visible on the
// page. Markup describing answers a reader cannot see gets the structured data
// ignored at best. Generating both from one source makes that true by
// construction; these tests prove it stayed true through the build.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const faqHtml = () => readFileSync(join(distRoot, 'help/faq/index.html'), 'utf8')

const graphOf = (html) => {
  const match = html.match(/<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/s)
  return match ? JSON.parse(match[1])['@graph'] : []
}

/** Text as a reader sees it: tags stripped, entities resolved, spacing collapsed. */
const visibleText = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')

describe('the FAQ page', () => {
  it('is built', () => {
    expect(existsSync(join(distRoot, 'help/faq/index.html'))).toBe(true)
  })

  it('shows every question and answer to a reader', () => {
    const text = visibleText(faqHtml())
    for (const item of FAQ) {
      expect(text, `question missing from the page: ${item.question}`).toContain(item.question)
      expect(text, `answer missing from the page: ${item.question}`).toContain(item.answer)
    }
  })

  it('marks up exactly what it shows', () => {
    const faq = graphOf(faqHtml()).find((node) => node['@type'] === 'FAQPage')
    expect(faq).toBeDefined()
    expect(faq.mainEntity).toHaveLength(FAQ.length)

    const text = visibleText(faqHtml())
    for (const entity of faq.mainEntity) {
      expect(text).toContain(entity.name)
      expect(text).toContain(entity.acceptedAnswer.text)
    }
  })

  it('links each answer to the page it came from', () => {
    const html = faqHtml()
    for (const item of FAQ) {
      expect(html, `no link to ${item.source}`).toContain(`href="${item.source}"`)
    }
  })

  it('links only to pages that were built', () => {
    for (const item of FAQ) {
      expect(
        existsSync(join(distRoot, item.source.replace(/^\/|\/$/g, ''), 'index.html')),
        `source is a 404: ${item.source}`,
      ).toBe(true)
    }
  })

  it('keeps the other nodes, so the page is still part of the graph', () => {
    const types = graphOf(faqHtml()).map((node) => node['@type'])
    expect(types).toEqual(expect.arrayContaining(['Person', 'WebSite', 'TechArticle', 'FAQPage']))
  })
})

describe('the FAQ is reachable', () => {
  // It was reachable only from the Starlight sidebar, so 16 of 22 pages linked
  // it and the landing page did not. That is the wrong way round: someone
  // deciding whether to install is exactly the reader asking whether this
  // exposes their data.
  //
  // The link therefore lives in both footers, and it has to, because this site
  // renders through two layout paths that share nothing. The same trap took two
  // attempts for the font preloads and again for the consent banner.
  function layoutPages() {
    const out = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) {
          // Hand-authored files copied out of public/. They carry their own
          // minimal shell and never pass through either layout.
          if (['demo', 'theme-builder'].includes(relative(distRoot, full))) continue
          walk(full)
        } else if (entry.endsWith('.html')) {
          out.push(full)
        }
      }
    }
    walk(distRoot)
    return out
  }

  it('is linked from every page rendered through either layout', () => {
    const missing = layoutPages()
      .filter((file) => !readFileSync(file, 'utf8').includes('href="/help/faq/"'))
      .map((file) => relative(distRoot, file))

    expect(missing).toEqual([])
  })
})

describe('the on-this-page nav', () => {
  // Starlight builds the contents from markdown headings and cannot see headings
  // a component rendered, so this page first shipped with the nav switched off:
  // the only page on the site without one, and every question unlinkable. A
  // route middleware now supplies it from the same data the page renders.
  const tocHtml = () => {
    const match = faqHtml().match(/starlight__on-this-page[\s\S]*?<\/nav>/)
    return match ? match[0] : ''
  }

  it('exists at all', () => {
    expect(tocHtml()).not.toBe('')
  })

  it('lists every question, in page order', () => {
    const labels = [...tocHtml().matchAll(/<span[^>]*>([^<]+)<\/span>/g)].map((m) => m[1].trim())
    expect(labels).toEqual(['Overview', ...FAQ.map((item) => item.question)])
  })

  it('points at anchors the page actually renders', () => {
    const html = faqHtml()
    const ids = new Set([...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
    const anchors = [...tocHtml().matchAll(/href="#([^"]+)"/g)].map((m) => m[1])

    expect(anchors.length).toBeGreaterThan(FAQ.length)
    expect(anchors.filter((anchor) => !ids.has(anchor))).toEqual([])
  })
})

describe('no other page claims to be an FAQ', () => {
  function htmlPages(dir = distRoot, out = []) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      if (statSync(full).isDirectory()) {
        if (['demo', 'theme-builder'].includes(relative(distRoot, full))) continue
        htmlPages(full, out)
      } else if (entry.endsWith('.html')) {
        out.push(full)
      }
    }
    return out
  }

  it('emits FAQPage on the FAQ page and nowhere else', () => {
    // The flag is per page on purpose. A site-wide FAQPage would assert that
    // every page is a list of questions, which is both false and the kind of
    // thing that gets structured data distrusted wholesale.
    const withFaq = htmlPages()
      .filter((file) => graphOf(readFileSync(file, 'utf8')).some((n) => n['@type'] === 'FAQPage'))
      .map((file) => relative(distRoot, file))

    expect(withFaq).toEqual(['help/faq/index.html'])
  })
})
