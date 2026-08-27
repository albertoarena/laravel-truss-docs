import { describe, it, expect } from 'vitest'

import { FAQ } from '../src/data/faq.ts'
import { faqNode } from '../src/scripts/structured-data.js'
import { questionId, faqToc } from '../src/scripts/faq.js'

// The FAQ is the one piece of this work that is content rather than plumbing.
// Answer engines reward a question heading followed by a short, self-contained
// answer; the rest of this site is task-shaped ("Installation", "Configuration")
// and answers nothing directly.
//
// Every answer here is drawn from the existing documentation. None of it may
// introduce a claim the docs do not already make, which is why each entry
// carries the page it came from and a test insists on it.

const SITE = 'https://trussphp.com'

describe('the FAQ content', () => {
  it('asks real questions', () => {
    for (const { question } of FAQ) {
      expect(question.endsWith('?'), `not a question: ${question}`).toBe(true)
    }
  })

  it('answers every question in a self-contained paragraph', () => {
    for (const { question, answer } of FAQ) {
      expect(answer.length, `empty answer: ${question}`).toBeGreaterThan(80)
    }
  })

  it('keeps answers short enough to be quoted whole', () => {
    // Roughly 80 words. An answer an engine has to truncate is one it will
    // paraphrase instead, and a paraphrase is where the errors come from.
    for (const { question, answer } of FAQ) {
      const words = answer.split(/\s+/).length
      expect(words, `too long (${words} words): ${question}`).toBeLessThanOrEqual(80)
    }
  })

  it('cites the documentation each answer came from', () => {
    // The rule for this page: no answer may introduce a claim the docs do not
    // already make. A required source is what makes that checkable.
    for (const { question, source } of FAQ) {
      expect(source, `no source: ${question}`).toMatch(/^\/[a-z0-9/-]+\/$/)
    }
  })

  it('asks nothing twice', () => {
    const questions = FAQ.map((item) => item.question.toLowerCase())
    expect(new Set(questions).size).toBe(questions.length)
  })

  it('leads with the question the package is judged on', () => {
    // "Structure only, never data" is the core promise. If an engine reads one
    // entry, it should be that one.
    expect(FAQ[0].question.toLowerCase()).toMatch(/data/)
    expect(FAQ[0].answer).toMatch(/structure only/i)
  })

  it('covers the ground someone evaluating the package asks about', () => {
    const text = FAQ.map((item) => `${item.question} ${item.answer}`).join(' ').toLowerCase()
    // The PHP version is pinned on purpose rather than matched loosely: when the
    // floor moves, this test should fail and make somebody check the other
    // places that state it. It caught exactly that on the 8.3 to 8.2 change,
    // where the requirement also lives in installation.mdx, llms.txt and the
    // package README.
    for (const topic of ['php 8.2', 'laravel 12', 'production', 'connection', 'demo']) {
      expect(text, `nothing about ${topic}`).toContain(topic)
    }
  })
})

describe('faqNode', () => {
  const node = faqNode(SITE, FAQ)

  it('is a FAQPage of Questions', () => {
    expect(node['@type']).toBe('FAQPage')
    expect(node.mainEntity).toHaveLength(FAQ.length)
    expect(node.mainEntity[0]['@type']).toBe('Question')
  })

  it('pairs each question with an accepted answer', () => {
    for (const entity of node.mainEntity) {
      expect(entity.name.length).toBeGreaterThan(0)
      expect(entity.acceptedAnswer['@type']).toBe('Answer')
      expect(entity.acceptedAnswer.text.length).toBeGreaterThan(0)
    }
  })

  it('carries the answer text verbatim, never a summary of it', () => {
    // Marking up something other than what the page shows is what gets a
    // FAQPage ignored, or penalised.
    FAQ.forEach((item, index) => {
      expect(node.mainEntity[index].acceptedAnswer.text).toBe(item.answer)
      expect(node.mainEntity[index].name).toBe(item.question)
    })
  })

  it('is null for an empty list rather than an empty FAQPage', () => {
    expect(faqNode(SITE, [])).toBeNull()
  })
})

describe('questionId', () => {
  // The questions are h2s, so they deserve anchors and a contents list like
  // every other page. Starlight builds both from markdown headings and cannot
  // see headings a component rendered, so the ids and the contents are derived
  // from the same data the page is.
  it('slugifies a question into a usable anchor', () => {
    expect(questionId('Does Laravel Truss expose my data?')).toBe('does-laravel-truss-expose-my-data')
  })

  it('drops punctuation rather than encoding it', () => {
    expect(questionId('What PHP and Laravel versions does it require?')).toBe(
      'what-php-and-laravel-versions-does-it-require',
    )
  })

  it('collapses runs of separators instead of leaving empty segments', () => {
    expect(questionId('A  question -- with   gaps?')).toBe('a-question-with-gaps')
  })

  it('gives every real question a distinct anchor', () => {
    const ids = FAQ.map((item) => questionId(item.question))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('produces nothing a URL fragment would have to escape', () => {
    for (const item of FAQ) {
      expect(questionId(item.question)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

describe('faqToc', () => {
  const toc = faqToc(FAQ)

  it('opens with Overview, the way Starlight builds every other page', () => {
    expect(toc[0]).toEqual({ depth: 2, slug: '_top', text: 'Overview', children: [] })
  })

  it('lists one entry per question, in page order', () => {
    expect(toc.slice(1).map((item) => item.text)).toEqual(FAQ.map((item) => item.question))
  })

  it('points each entry at the anchor the page renders', () => {
    expect(toc.slice(1).map((item) => item.slug)).toEqual(FAQ.map((item) => questionId(item.question)))
  })

  it('keeps every entry at h2 depth with no children', () => {
    for (const item of toc) {
      expect(item.depth).toBe(2)
      expect(item.children).toEqual([])
    }
  })
})
