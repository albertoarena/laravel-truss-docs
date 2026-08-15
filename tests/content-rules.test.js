import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const PUBLIC_TEXT = ['public/robots.txt'].map((path) => join(root, path))

const files = [
  ...CONTENT_DIRS.flatMap((d) => walk(join(root, d))),
  DEMO_WRAPPER,
  ...PUBLIC_TEXT,
]

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
        if (line.includes('—') || line.includes('–')) {
          offenders.push(`${file.replace(root, '')}:${i + 1}`)
        }
      })
    }
    expect(offenders, `em/en dash found at:\n${offenders.join('\n')}`).toEqual([])
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
