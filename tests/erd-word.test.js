import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { FAQ } from '../src/data/faq.ts'

/**
 * The category word, and the two places it is allowed to be.
 *
 * `ERD` appeared zero times on the whole site while two rival `laravel-erd`
 * packages held the category name. Lane 1 of the ERD strategy put it in the home
 * title tag and in two FAQ entries, and nowhere else.
 *
 * These assertions exist because both halves of that change are silently
 * reversible. A title can be lengthened by anyone adding a few honest words, and
 * an FAQ entry can be edited without anyone remembering it was carrying a word
 * on purpose. Neither would fail any existing test.
 */

const HOME = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8')

const homeTitle = () => HOME.match(/title="([^"]*)"/)?.[1] ?? ''

describe('the home title tag', () => {
  it('carries the acronym, which is the whole point of the change', () => {
    expect(homeTitle()).toContain('ERD')
  })

  /**
   * The first attempt was "Laravel Truss: a live database structure viewer and
   * ER diagram (ERD)", which is 68 characters. Google truncates around 60, and
   * the acronym sits at the end, so that version would have dropped the one word
   * it was added to carry. Sixty is the guard rather than a preference.
   */
  it('is short enough that the acronym is not the part truncated', () => {
    expect(homeTitle().length).toBeLessThanOrEqual(60)
  })

  it('still says what the product is, rather than trading the description for the word', () => {
    expect(homeTitle()).toContain('Laravel Truss')
    expect(homeTitle()).toContain('database')
  })
})

describe('the ERD FAQ entries', () => {
  const erdEntries = FAQ.filter((item) => item.question.includes('ERD'))

  it('keeps both of them', () => {
    expect(erdEntries).toHaveLength(2)
  })

  /**
   * The second entry is the one that matters and it is not there for search. It
   * answers issue #38 in public, before somebody installs and meets an empty
   * diagram, so an application declaring relations only in Eloquent is warned
   * rather than ambushed.
   */
  it('warns that relations come from foreign keys, not from Eloquent', () => {
    const expectations = erdEntries.find((item) => item.question.includes('Eloquent'))

    expect(expectations).toBeDefined()
    expect(expectations.answer).toContain('foreign keys')
    expect(expectations.answer).toContain('Eloquent')
  })

  /**
   * TRUSS-INT-002 is LikelyMissingForeignKey, and the field study measured it
   * firing 45 times across six applications, some correctly and some not. The
   * doctor reports a suspicion, so the copy has to say so: "look missing", never
   * "are missing".
   */
  it('describes the doctor as reporting a suspicion rather than a fact', () => {
    const expectations = erdEntries.find((item) => item.question.includes('Eloquent'))

    expect(expectations.answer).toContain('look missing')
    expect(expectations.answer).not.toContain('are missing')
  })

  /**
   * Three exclusions from the draft, each with its own reason. The competitor
   * claim is true and still not allowed, because this file may not introduce a
   * claim the documentation does not make. The application count belongs to
   * /reference/tested-applications/ and would be wrong in two places the first
   * time it changed. And WCAG conformance is never claimed anywhere (R18).
   */
  it('makes no competitor claim, states no application count, and never mentions WCAG', () => {
    for (const item of erdEntries) {
      expect(item.answer).not.toMatch(/other (Laravel )?(ERD )?(tools|packages)/i)
      expect(item.answer).not.toMatch(/\b(20|twenty) (real )?(Laravel )?applications\b/i)
      expect(item.answer).not.toMatch(/WCAG/i)
    }
  })
})
