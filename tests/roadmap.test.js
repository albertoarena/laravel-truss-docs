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
      // A section may be empty (e.g. nothing committed as "Approved next"); an
      // empty section simply does not render. Items must be an array either way.
      expect(Array.isArray(s.items), `items array for ${s.status}`).toBe(true)
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

  it('marks shipped package releases with the version that landed them', () => {
    const shipped = SECTIONS.find((s) => s.status === 'shipped').items
    for (const item of shipped) {
      if (item.tag === 'docs-site') {
        // Docs-site tools ship with the website, not a package release, so they
        // carry no version. Guard against one being fabricated.
        expect(item.version, `docs-site item ${item.title} must not claim a package version`).toBeUndefined()
      } else {
        expect(item.version, `version for ${item.title}`).toMatch(/^v\d+\.\d+\.\d+$/)
      }
    }
  })

  it('files the community-requested manual layout under wishlist, linked to issue #2', () => {
    const manual = ALL.find((i) => /manual/i.test(i.title))
    expect(manual, 'manual layout item exists').toBeTruthy()
    expect(manual.status).toBe('wishlist')
    expect(manual.tag).toBe('community requested')
    expect(manual.issueUrl).toBe('https://github.com/albertoarena/laravel-truss/issues/2')
  })

  it('files the community-requested dependency slimming under wishlist, linked to issue #45', () => {
    const deps = ALL.find((i) => /dependenc/i.test(i.title))
    expect(deps, 'dependency item exists').toBeTruthy()
    expect(deps.status).toBe('wishlist')
    expect(deps.tag).toBe('community requested')
    expect(deps.issueUrl).toBe('https://github.com/albertoarena/laravel-truss/issues/45')
    // A roadmap card shares the concept, not the plan. It should describe what
    // a user would notice and name no vendor package, since which dependency
    // goes and how is an implementation decision that is not committed to.
    expect(deps.blurb).not.toMatch(/spatie|package-tools/i)
  })

  it('commits Laravel Boost support under approved next', () => {
    const boost = ALL.find((i) => /boost/i.test(i.title))
    expect(boost, 'Laravel Boost item exists').toBeTruthy()
    expect(boost.status).toBe('approved')
    // The point of the item is that Boost users get Truss context without
    // wiring our MCP server up by hand, so the blurb has to say so.
    expect(boost.blurb).toMatch(/boost/i)
  })

  it('promotes the remaining schema doctor work to approved next', () => {
    const doctor = ALL.find((i) => /doctor/i.test(i.title) && i.status !== 'shipped')
    expect(doctor, 'follow-up doctor item exists').toBeTruthy()
    expect(doctor.status).toBe('approved')
  })

  it('moves the Filament plugin from wishlist to exploring', () => {
    const filament = ALL.find((i) => /filament/i.test(i.title))
    expect(filament, 'Filament item exists').toBeTruthy()
    expect(filament.status).toBe('exploring')
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
