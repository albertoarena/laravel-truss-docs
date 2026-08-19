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
// they are exercised against fixtures rather than against the published set: a
// rule that has never rejected anything is not known to work, and every real
// row is expected to pass. The published set is checked too, separately, since
// it is generated now and a bad export would otherwise be invisible.

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

describe('the generated set', () => {
  // Every rule in the block below is a loop, and a loop over an empty array
  // passes. That was tolerable while the rows were written in this file, where
  // emptiness showed up in a diff. They are generated now, so a broken export
  // would leave the whole suite green and the page blank.
  it('is not empty, because every rule below passes on nothing', () => {
    expect(MENTIONS.length).toBeGreaterThan(0)
  })

  // The exporter sorts by date and the page relies on it. Asserting it here
  // means a change at either end has to break this test first.
  it('is sorted oldest first, since any other order publishes a ranking', () => {
    const dates = MENTIONS.map((m) => m.date)
    expect(dates).toEqual([...dates].sort())
  })

  it('carries a basis on every row, so nothing ships without somebody deciding', () => {
    for (const row of MENTIONS) {
      expect(['public-post', 'permission-given'], row.url).toContain(row.basis)
    }
  })
})

describe('the published set', () => {
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

  it('gives every row a quote, because a bare name says nothing', () => {
    // Replaces a rule that allowed quotes only on press and report rows. That
    // was right while the template rendered a quote as a pull-quote looming
    // above the attribution, which presents an excerpt as an endorsement and is
    // the thing worth asking permission for. The template cites now, so the
    // restriction blocked exactly the case citation exists to enable, and five
    // quoteless rows had already been taken off for saying nothing.
    //
    // What replaced it is the stronger rule: no row ships without words.
    for (const row of MENTIONS) {
      expect(row.quote, `${row.author} has nothing to say`).toBeTruthy()
    }
  })

  it('links a source for every quote, which is what makes it a citation', () => {
    for (const row of MENTIONS.filter((m) => m.quote)) {
      expect(row.url, row.author).toMatch(/^https:\/\//)
    }
  })

  it('names the release that answered every report', () => {
    for (const row of MENTIONS.filter((m) => m.kind === 'report')) {
      expect(row.fixedIn, row.author).toMatch(/^v\d+\.\d+\.\d+$/)
    }
  })

  it('states a role for nobody', () => {
    // The rule is never to say anything about a person their visible source does
    // not show. This asserts the current state and nothing about why: an earlier
    // version of this comment claimed roles were absent because no source
    // displayed one, which was never checked and is false. LinkedIn posts do
    // show headlines. If roles are ever captured, this test changes with them.
    expect(MENTIONS.filter((m) => m.role)).toEqual([])
  })

  it('keeps press out of the collapsed list, so the editorial is not last', () => {
    expect(shouldCollapse(MENTIONS)).toBe(false)
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

  const many = (kind, n) =>
    Array.from({ length: n }, (_, i) => ({ ...VALID[0], kind, url: `https://example.com/${kind}${i}` }))

  it('collapses press and community when there are fewer than six rows between them', () => {
    // Decided in advance, not judged on the day: three sections with two rows
    // each reads worse than one section with six.
    expect(shouldCollapse(VALID)).toBe(true)
    expect(shouldCollapse([...many('press', 3), ...many('community', 3)])).toBe(false)
    expect(shouldCollapse([...many('press', 3), ...many('community', 2)])).toBe(true)
  })

  it('does not collapse a lopsided set that is not actually thin', () => {
    // The assertions above pass under a per-section rule too, so they cannot
    // tell the two apart. This one can, and it is the shape of the real set:
    // two press rows and ten community ones. Counting each section separately
    // merged them, sorted by date, and put the oldest row last, which is where
    // the editorial would have landed.
    expect(shouldCollapse([...many('press', 2), ...many('community', 10)])).toBe(false)
    expect(shouldCollapse([...many('press', 1), ...many('community', 10)])).toBe(false)
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

  it('takes its rows from the export and holds none by hand', () => {
    // The invariant that replaced hand transcription, and until now the only one
    // here without a test. Hand-written rows are what produced a coverage row
    // carrying three different dates across three files.
    expect(source).toContain("import generated from './in-the-wild.generated.json'")
    expect(source).toMatch(/export const MENTIONS: Mention\[\] = generated as Mention\[\]/)

    const start = verbatimFieldStart(VERBATIM_FIELDS)
    const handWritten = source
      .split('\n')
      .map((text, i) => ({ text, n: i + 1 }))
      // The interface declares these fields; a row would assign them.
      .filter(({ text }) => start.test(text) && !/\?:|:\s*string/.test(text))
      .map(({ n }) => `src/data/in-the-wild.ts:${n}`)

    expect(handWritten).toEqual([])
  })

  it('still keeps any hand-written verbatim field on one line', () => {
    // Vacuous while every row comes from the export, and deliberately kept: the
    // carve-out in content-rules.test.js only blanks single-line assignments, so
    // if somebody ever does append a row here, a multi-line quote would slip its
    // punctuation past the scan in one direction and past the reader in the
    // other. The assertion above is what stops this one passing for free
    // unnoticed: hand-written rows fail there first, and loudly.
    const line = verbatimFieldLine(VERBATIM_FIELDS)
    const start = verbatimFieldStart(VERBATIM_FIELDS)
    const offenders = source
      .split('\n')
      .map((text, i) => ({ text, n: i + 1 }))
      .filter(({ text }) => start.test(text) && !line.test(text))
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
