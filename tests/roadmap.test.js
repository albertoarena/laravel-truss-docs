import { describe, it, expect } from 'vitest'
import { SECTIONS, STATUS_ORDER } from '../src/data/roadmap.ts'

const ALL = SECTIONS.flatMap((s) => s.items)

describe('roadmap data', () => {
  it('has the four agreed sections in momentum order', () => {
    expect(SECTIONS.map((s) => s.status)).toEqual([
      'shipped',
      'approved',
      'exploring',
      'wishlist',
    ])
    expect(STATUS_ORDER).toEqual(['shipped', 'approved', 'exploring', 'wishlist'])
  })

  it('gives every section a human label and a commitment note', () => {
    for (const s of SECTIONS) {
      expect(s.label, `label for ${s.status}`).toBeTruthy()
      expect(s.commitment, `commitment for ${s.status}`).toBeTruthy()
      expect(s.items.length, `items in ${s.status}`).toBeGreaterThan(0)
    }
  })

  it('gives every item a title, a blurb, and a status that matches its section', () => {
    for (const s of SECTIONS) {
      for (const item of s.items) {
        expect(item.title, 'title').toBeTruthy()
        expect(item.blurb, `blurb for ${item.title}`).toBeTruthy()
        expect(item.status, `status for ${item.title}`).toBe(s.status)
      }
    }
  })

  it('links only to GitHub or Ko-fi when a link is present', () => {
    for (const item of ALL) {
      if (item.issueUrl) {
        expect(item.issueUrl, item.title).toMatch(
          /^https:\/\/github\.com\/albertoarena\/laravel-truss/,
        )
      }
    }
  })

  it('marks shipped items with the release that landed them', () => {
    const shipped = SECTIONS.find((s) => s.status === 'shipped').items
    for (const item of shipped) {
      expect(item.version, `version for ${item.title}`).toMatch(/^v\d+\.\d+\.\d+$/)
    }
  })

  it('files the community-requested manual layout under wishlist, linked to issue #2', () => {
    const manual = ALL.find((i) => /manual/i.test(i.title))
    expect(manual, 'manual layout item exists').toBeTruthy()
    expect(manual.status).toBe('wishlist')
    expect(manual.tag).toBe('community requested')
    expect(manual.issueUrl).toBe('https://github.com/albertoarena/laravel-truss/issues/2')
  })

  it('keeps private strategy items out of the public roadmap', () => {
    const haystack = JSON.stringify(ALL).toLowerCase()
    for (const secret of ['ko-fi mechanics', 'fiscal', 'commercialista', 'pest v5', 'depth-autofocus', 'wordmark']) {
      expect(haystack, `leaked: ${secret}`).not.toContain(secret)
    }
  })

  it('uses no em or en dashes in any blurb', () => {
    for (const item of ALL) {
      expect(item.blurb + (item.tag ?? ''), item.title).not.toMatch(/[—–]/)
    }
  })
})
