import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  MENTIONS,
  SECTIONS,
  SOURCES,
  VERBATIM_FIELDS,
  QUOTE_MAX,
  SELF_AUTHORED,
} from '../src/data/in-the-wild.ts'
import {
  problemsWith,
  selfAuthoredMatch,
  bySection,
  shouldCollapse,
  formatDate,
  initialsOf,
  verbatimFieldLine,
  verbatimFieldStart,
} from '../src/scripts/in-the-wild.js'
import { VALID, INVALID, USER_ISSUE } from './fixtures/in-the-wild.js'

// This page publishes what real, named people said. The failure mode is not a
// broken layout, it is an invented testimonial on a public site, which cannot
// be walked back. So the rules are executable rather than written down, and
// they are exercised against fixtures rather than against the published set:
// MENTIONS is empty until the candidate list is assembled privately, and a rule
// that has never rejected anything is not known to work.

const root = fileURLToPath(new URL('..', import.meta.url))
const KINDS = SECTIONS.map((section) => section.kind)

describe('the curation rules, against fixtures', () => {
  it('accepts every shape the page supports', () => {
    for (const row of VALID) {
      expect(problemsWith(row, KINDS), row.url).toEqual([])
    }
  })

  it.each(INVALID)('rejects a row with $why', ({ expect: needle, row }) => {
    const problems = problemsWith(row, KINDS)

    expect(problems.length, 'was rejected at all').toBeGreaterThan(0)
    expect(problems.join(' | '), `mentions "${needle}"`).toContain(needle)
  })

  it('keeps an issue opened by a user on Alberto’s own repository', () => {
    // The repository is his, the words are not. Authorship decides, not the
    // domain, and getting this backwards would drop the strongest section on
    // the page: a stranger reporting a bug and the fix shipping the same day.
    expect(problemsWith(USER_ISSUE, KINDS)).toEqual([])
  })
})

describe('the published set', () => {
  // Vacuous while MENTIONS is empty, and that is the point of the fixtures
  // above. It stops being vacuous the moment the first real row lands, which is
  // the moment it starts mattering.
  it('breaks none of the rules', () => {
    for (const row of MENTIONS) {
      expect(problemsWith(row, KINDS), row.url).toEqual([])
    }
  })

  it('carries no duplicate URLs', () => {
    const urls = MENTIONS.map((m) => m.url)
    expect(new Set(urls).size).toBe(urls.length)
  })

  it('is either empty or has something to show in every section it claims', () => {
    for (const section of bySection(MENTIONS, SECTIONS)) {
      expect(section.items.length, section.label).toBeGreaterThan(0)
    }
  })
})

describe('what is excluded', () => {
  it('names a reason for every excluded source, because a rule nobody can read is a rule that lasts one release', () => {
    for (const entry of SELF_AUTHORED) {
      expect(entry.host, 'host').toBeTruthy()
      expect(entry.why.length, `why for ${entry.host}`).toBeGreaterThan(10)
    }
  })

  it('matches on subdomains and ignores www', () => {
    expect(selfAuthoredMatch('https://albertoarena.it/x')).toBeTruthy()
    expect(selfAuthoredMatch('https://www.albertoarena.it/x')).toBeTruthy()
    expect(selfAuthoredMatch('https://notes.albertoarena.it/x')).toBeTruthy()
  })

  it('narrows to a path where only part of a domain is self-authored', () => {
    // The distinction the whole GitHub row rests on.
    expect(selfAuthoredMatch('https://github.com/albertoarena/laravel-truss/blob/main/README.md')).toBeTruthy()
    expect(selfAuthoredMatch('https://github.com/albertoarena/laravel-truss/issues/2')).toBeNull()

    // And the Laravel News one: the editorial is in, the Links entry is not.
    expect(selfAuthoredMatch('https://laravel-news.com/links/laravel-truss')).toBeTruthy()
    expect(selfAuthoredMatch('https://laravel-news.com/laravel-truss')).toBeNull()
  })

  it('leaves LinkedIn and X open, since they are the bulk of the real set', () => {
    expect(selfAuthoredMatch('https://www.linkedin.com/posts/someone-else')).toBeNull()
    expect(selfAuthoredMatch('https://x.com/someone-else/status/1')).toBeNull()
  })

  it('treats an unparseable URL as unusable rather than as permitted', () => {
    expect(problemsWith({ ...VALID[0], url: 'not a url' }, KINDS).length).toBeGreaterThan(0)
  })
})

describe('sections and ordering', () => {
  it('runs press, community, report, which is the order trust is built in', () => {
    expect(KINDS).toEqual(['press', 'community', 'report'])
  })

  it('gives every section a label and a blurb', () => {
    for (const section of SECTIONS) {
      expect(section.label, section.kind).toBeTruthy()
      expect(section.blurb, section.kind).toBeTruthy()
    }
  })

  it('sorts newest first and by nothing else', () => {
    // The likeliest way to leak the private ledger is not pasting a number, it
    // is ordering the page by how well somebody performed. Date, always.
    const [community] = bySection(VALID, SECTIONS).filter((s) => s.kind === 'community')
    expect(community.items.map((m) => m.date)).toEqual(['2026-08-14', '2026-08-02'])
  })

  it('drops a section with nothing in it rather than rendering an empty heading', () => {
    const sections = bySection(VALID.filter((m) => m.kind !== 'report'), SECTIONS)
    expect(sections.map((s) => s.kind)).toEqual(['press', 'community'])
  })

  it('collapses press and community below three rows in either', () => {
    // Decided in advance, not judged on the day: three sections with two rows
    // each reads worse than one section with six.
    expect(shouldCollapse(VALID)).toBe(true)

    const many = (kind, n) =>
      Array.from({ length: n }, (_, i) => ({ ...VALID[0], kind, url: `https://example.com/${kind}${i}` }))
    expect(shouldCollapse([...many('press', 3), ...many('community', 3)])).toBe(false)
    expect(shouldCollapse([...many('press', 3), ...many('community', 2)])).toBe(true)
  })
})

describe('rendering helpers', () => {
  it('spells the date out, so 10/08 cannot be read as 08/10', () => {
    expect(formatDate('2026-08-10')).toBe('10 Aug 2026')
  })

  it('does not move a date by a day on a machine west of UTC', () => {
    expect(formatDate('2026-08-10T00:30:00Z')).toBe('10 Aug 2026')
  })

  it('hands back an unparseable date untouched rather than printing Invalid Date', () => {
    expect(formatDate('14th of August')).toBe('14th of August')
  })

  it('takes at most two initials, and handles a single name', () => {
    expect(initialsOf('Fixture Developer')).toBe('FD')
    expect(initialsOf('Fixture Middle Developer')).toBe('FM')
    expect(initialsOf('Fixture')).toBe('F')
    expect(initialsOf('')).toBe('')
  })
})

describe('the shape of the data module', () => {
  const source = readFileSync(join(root, 'src/data/in-the-wild.ts'), 'utf8')

  it('suggests sources without closing the list', () => {
    // `'Laravel News' | ... | string` collapses to string and the literals stop
    // doing anything, which is why the type uses the intersection form instead.
    expect(SOURCES.length).toBeGreaterThan(0)
    expect(source).toContain('(typeof SOURCES)[number] | (string & {})')
  })

  it('names the fields that hold somebody else’s words', () => {
    expect([...VERBATIM_FIELDS]).toEqual(['quote', 'translation', 'role'])
  })

  it('keeps every verbatim field on one line', () => {
    // What makes the house-style carve-out in content-rules.test.js reliable
    // without parsing TypeScript. A template literal spanning lines would slip
    // a quote past the scan in one direction and past the reader in the other.
    const line = verbatimFieldLine(VERBATIM_FIELDS)
    const start = verbatimFieldStart(VERBATIM_FIELDS)
    const offenders = source
      .split('\n')
      .map((text, i) => ({ text, n: i + 1 }))
      .filter(({ text }) => start.test(text) && !line.test(text))
      // The interface declares these fields; only the rows assign them.
      .filter(({ text }) => !/\?:|:\s*string/.test(text))
      .map(({ n }) => `src/data/in-the-wild.ts:${n}`)

    expect(offenders).toEqual([])
  })

  it('exempts a quote from the house style rule without exempting the file', () => {
    const line = verbatimFieldLine(VERBATIM_FIELDS)

    expect(line.test("    quote: 'ship production AI — LLMs, RAG',")).toBe(true)
    expect(line.test("    role: 'Staff writer — Laravel News',")).toBe(true)
    // Everything else in the file stays covered, including our own prose.
    expect(line.test('   * A doc comment — still ours to write properly.')).toBe(false)
    expect(line.test("    blurb: 'Written by somebody else — not us.',")).toBe(false)
  })

  it('caps a quote at a pull-quote rather than a reprint', () => {
    expect(QUOTE_MAX).toBe(300)
  })
})

describe('the fixtures stay in the tests', () => {
  it('is imported by nothing under src/', () => {
    // The one way invented rows reach the page. Cheap to check, and the cost of
    // missing it is the failure this page cannot recover from.
    const offenders = []
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry)
        if (statSync(full).isDirectory()) walk(full)
        else if (['.astro', '.ts', '.js', '.mdx', '.md'].includes(extname(entry))) {
          // Imports, not mentions: the data module names the fixture file in a
          // doc comment on purpose, to say where the rules are exercised.
          const imports = /(?:from|import\()\s*['"][^'"]*fixtures[^'"]*['"]/
          if (imports.test(readFileSync(full, 'utf8'))) offenders.push(full.replace(root, ''))
        }
      }
    }
    walk(join(root, 'src'))

    expect(offenders).toEqual([])
  })
})
