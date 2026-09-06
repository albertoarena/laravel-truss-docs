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

  it('ships Laravel Boost support in v1.10.0', () => {
    const boost = ALL.filter((i) => /boost/i.test(i.title))
    // Moved from approved next to shipped on release. Asserted as exactly one
    // card, because promoting an item means moving it rather than copying it,
    // and a duplicate would show the same feature as both shipped and planned.
    expect(boost, 'exactly one Laravel Boost card').toHaveLength(1)
    expect(boost[0].status).toBe('shipped')
    expect(boost[0].version).toBe('v1.10.0')
    // The point of the item is that Boost users get Truss context without
    // wiring our MCP server up by hand, so the blurb has to say so.
    expect(boost[0].blurb).toMatch(/boost/i)
    // Discovery is automatic, installation is not: nothing third-party is
    // preselected, so a card claiming it just appears would be wrong.
    expect(boost[0].blurb).toMatch(/tick|boost:install/i)
  })

  it('ships the keyboard and screen reader work in v1.9.0', () => {
    const a11y = ALL.find((i) => /accessib/i.test(i.title) && i.tag !== 'docs-site')
    expect(a11y, 'accessibility item exists').toBeTruthy()
    expect(a11y.status).toBe('shipped')
    expect(a11y.version).toBe('v1.9.0')
  })

  it('claims no WCAG conformance anywhere on the roadmap', () => {
    // v1.9.0 closed the Level A keyboard failures it found; it did not audit
    // every criterion, and a custom theme can fail contrast whatever the
    // package ships. A roadmap card is a published claim, so it must not read
    // as a conformance statement.
    for (const item of ALL) {
      expect(item.blurb, item.title).not.toMatch(/wcag[^.]*\b(conformant|compliant)\b/i)
    }
  })

  it('keeps the accessible structure view and the conformance statement exploring, as two cards', () => {
    // One card promised both the feature and the statement under "committed,
    // building next", while no release slot was ever set aside for either and
    // the four questions the structure view turns on are all still open. Two
    // Exploring cards say what is actually true.
    const view = ALL.find((i) => /structure view/i.test(i.title))
    const statement = ALL.find((i) => /conformance statement/i.test(i.title))
    for (const [label, item] of [['structure view', view], ['conformance statement', statement]]) {
      expect(item, `${label} card exists`).toBeTruthy()
      expect(item.status, label).toBe('exploring')
      expect(item.version, 'unshipped items carry no version').toBeUndefined()
    }
  })

  it('ships the searchable Focus picker in v1.9.0, credited to its issue', () => {
    const picker = ALL.find((i) => /focus picker/i.test(i.title))
    expect(picker, 'Focus picker item exists').toBeTruthy()
    expect(picker.status).toBe('shipped')
    expect(picker.version).toBe('v1.9.0')
    expect(picker.tag).toBe('community requested')
    expect(picker.issueUrl).toBe('https://github.com/albertoarena/laravel-truss/issues/39')
  })

  it('splits the remaining schema doctor work into rules and CI formats', () => {
    // One card promised both halves in one release. The rules have a plan and a
    // slot; the CI formats have neither, so committing to both together makes
    // the rules release read as a half delivery on the day it ships.
    const followUps = ALL.filter((i) => /doctor/i.test(i.title) && i.status !== 'shipped')
    expect(followUps, 'two follow-up doctor cards').toHaveLength(2)

    const rules = followUps.find((i) => /rule/i.test(i.title))
    expect(rules, 'rules card exists').toBeTruthy()
    expect(rules.status).toBe('approved')
    // Codes above the shipped thirteen are not published anywhere yet, and a
    // roadmap card is a publication. Naming them here would lock them.
    expect(rules.blurb, 'rules card publishes no rule codes').not.toMatch(/TRUSS-[A-Z]+-\d+/)

    const formats = followUps.find((i) => /CI/.test(i.title))
    expect(formats, 'CI formats card exists').toBeTruthy()
    expect(formats.status).toBe('exploring')
  })

  it('puts the self-contained HTML export next, since it is the next release', () => {
    const html = ALL.find((i) => /HTML export/i.test(i.title))
    expect(html, 'HTML export card exists').toBeTruthy()
    expect(html.status).toBe('approved')
    expect(html.version, 'unshipped items carry no version').toBeUndefined()
    // The point of the format is that the file needs nothing at all to open.
    expect(html.blurb).toMatch(/single|self-contained/i)
  })

  it('carries the standalone binary as approved next', () => {
    const binary = ALL.find((i) => /binary/i.test(i.title))
    expect(binary, 'standalone binary card exists').toBeTruthy()
    expect(binary.status).toBe('approved')
    expect(binary.version, 'unshipped items carry no version').toBeUndefined()
    // A card shares the concept, not the plan: how it is built and shipped is
    // an implementation decision that is not committed to in public.
    expect(binary.blurb, 'no build mechanics in the card').not.toMatch(/phar|box|export-ignore/i)
  })

  it('files the structural lint hints as shipped, since truss:doctor is what they became', () => {
    const hints = ALL.find((i) => /lint hints/i.test(i.title))
    expect(hints, 'structural lint hints card exists').toBeTruthy()
    expect(hints.status).toBe('shipped')
    expect(hints.version).toBe('v1.5.0')
    // It sat under "no timeline" for months describing a feature three cards
    // above it. A reader has to be able to tell the two cards apart, so it has
    // to name the thing it turned into.
    expect(hints.blurb).toMatch(/truss:doctor/)
  })

  it('keeps the shipped doctor card current with the rule v1.11.0 added', () => {
    // The reference guide documents every rule; the roadmap card is the only
    // place a reader sees what a release added without opening the changelog.
    const doctor = ALL.find((i) => /^Schema doctor$/i.test(i.title))
    expect(doctor, 'shipped doctor card exists').toBeTruthy()
    expect(doctor.status).toBe('shipped')
    expect(doctor.blurb).toMatch(/v1\.11\.0/)
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

describe('try-it links', () => {
  // A docs-site item ships with the website rather than a package release, so it
  // carries no version and had nothing pointing at the thing it delivered. The
  // roadmap said "shipped" and left the reader to go and find it. issueUrl could
  // not fill the gap: it is constrained to GitHub, which is the wrong
  // destination for something that lives on this site.
  const withTry = ALL.filter((item) => item.tryUrl)

  it('exist at all, since a shipped page nobody can reach from here is a dead end', () => {
    expect(withTry.length).toBeGreaterThan(0)
  })

  it('point somewhere on this site, not off it', () => {
    for (const item of withTry) {
      expect(item.tryUrl, item.title).toMatch(/^\/[\w/-]*\/$/)
    }
  })

  it('only appear on shipped items, since you cannot try what is not built', () => {
    for (const item of withTry) {
      expect(item.status, item.title).toBe('shipped')
    }
  })

  it('cover every shipped docs-site item', () => {
    // These are the only cards whose deliverable is a page on this site, so
    // every one of them has somewhere to send the reader.
    const docsSite = SECTIONS.find((s) => s.status === 'shipped').items
      .filter((item) => item.tag === 'docs-site')

    expect(docsSite.length).toBeGreaterThan(0)
    for (const item of docsSite) {
      expect(item.tryUrl, `${item.title} ships a page but links nowhere`).toBeTruthy()
    }
  })
})
