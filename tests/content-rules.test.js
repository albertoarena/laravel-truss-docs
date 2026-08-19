import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { VERBATIM_FIELDS } from '../src/data/in-the-wild.ts'
import { verbatimFieldLine } from '../src/scripts/in-the-wild.js'

const root = fileURLToPath(new URL('..', import.meta.url))

// Source we author and that ships prose to the site. Excludes generated and
// vendored trees, and the self-hosted font license (third-party text).
const CONTENT_DIRS = ['src']
const CONTENT_EXTS = new Set(['.astro', '.mdx', '.md', '.ts', '.js', '.css'])

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
    } else if (CONTENT_EXTS.has(extname(entry))) {
      out.push(full)
    }
  }
  return out
}

// The demo wrapper we author lives in public/ (its fetched assets alongside it
// are third-party and gitignored, so they are not scanned).
const DEMO_WRAPPER = join(root, 'public/demo/index.html')

// Hand-authored plain-text files under public/ that are served to readers and
// to crawlers. They are prose too, and until robots.txt arrived nothing under
// public/ except the demo wrapper was scanned, so the style rules simply did not
// apply to them.
const PUBLIC_TEXT = ['public/robots.txt', 'public/.well-known/ai.txt'].map((path) =>
  join(root, path),
)

const files = [
  ...CONTENT_DIRS.flatMap((d) => walk(join(root, d))),
  DEMO_WRAPPER,
  ...PUBLIC_TEXT,
]

// The file that may quote other people.
//
// House style forbids em dashes and en dashes in what we write, and strangers
// use them: a real headline in the coverage set reads "ship production AI —
// LLMs, RAG, workflow automation". Without a carve-out the two rules collide the
// first time such a row lands in src/data/in-the-wild.ts, and the obvious wrong
// fix is to edit somebody's quote to fit our punctuation.
//
// **Inert as things stand, and kept deliberately.** Every row now arrives
// through in-the-wild.generated.json, which this scan does not walk, so no line
// here currently needs blanking. The carve-out is the net for the path that is
// still open: appending a row by hand. Deleting it would leave that path
// arriving as a red build on somebody's sentence, which is the one situation
// where the tempting fix is the unrecoverable one.
//
// So the exemption is by field, not by file: only the values named in
// VERBATIM_FIELDS are skipped, and the doc comments, the section prose and the
// author names in that file stay covered like everything else. The field list is
// imported rather than repeated, so a fourth verbatim field cannot be added to
// the type and forgotten here.
//
// This is not a new kind of exception. The scan already leaves the self-hosted
// font license alone as third-party text. House style governs what we write, not
// what we reproduce.
const VERBATIM_FILE = join(root, 'src/data/in-the-wild.ts')
const VERBATIM_LINE = verbatimFieldLine(VERBATIM_FIELDS)

const scannable = (file, line) =>
  file === VERBATIM_FILE && VERBATIM_LINE.test(line) ? '' : line

describe('writing style rules', () => {
  it('finds site source to scan', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it('uses no em dashes or en dashes anywhere in the site source', () => {
    const offenders = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      const lines = text.split('\n')
      lines.forEach((line, i) => {
        if (scannable(file, line).match(/[—–]/)) {
          offenders.push(`${file.replace(root, '')}:${i + 1}`)
        }
      })
    }
    expect(offenders, `em/en dash found at:\n${offenders.join('\n')}`).toEqual([])
  })

  it('scans the quoted file, exempting only the quotes', () => {
    // The carve-out above is the kind of thing that rots into "skip that file".
    // These two assertions are what stop it: a quote may carry an em dash, and
    // our own prose in the same file may not.
    expect(files, 'the quoted file is still in the scan').toContain(VERBATIM_FILE)

    expect(scannable(VERBATIM_FILE, "    quote: 'ship production AI — LLMs',")).toBe('')
    expect(scannable(VERBATIM_FILE, '   * Our own doc comment — not exempt.')).toMatch(/—/)
    expect(scannable(join(root, 'src/data/roadmap.ts'), "    quote: 'a — b',")).toMatch(/—/)
  })

  it('never publishes the private or the dismissed contact address', () => {
    // Only hello@albertoarena.it belongs on a surface a reader or a scraper can
    // see. The personal address is fine in machine metadata such as composer
    // authorship and git commits, and the me@ alias is retired outright. Both
    // have reached published surfaces by mistake before, which is why this is a
    // test and not a note.
    const offenders = []
    for (const file of files) {
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, index) => {
        if (/arena\.alberto@gmail\.com|me@albertoarena\.it/.test(line)) {
          offenders.push(`${relative(root, file)}:${index + 1}`)
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it('never references the retired comparison tool', () => {
    const offenders = []
    for (const file of files) {
      if (/telescope/i.test(readFileSync(file, 'utf8'))) {
        offenders.push(file.replace(root, ''))
      }
    }
    expect(offenders, `forbidden reference at:\n${offenders.join('\n')}`).toEqual([])
  })
})
