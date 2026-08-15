import { describe, it, expect } from 'vitest'

import {
  SECTIONS,
  sectionOf,
  groupIntoSections,
  renderLlmsTxt,
  renderLlmsFullTxt,
} from '../src/scripts/llms-txt.js'

// llms.txt is an index of the documentation, written for agents that fetch it
// before reading a site. Worth being clear-eyed about its value: no major
// provider has committed to consuming it and measured bot traffic to it is
// negligible, so this is not what makes the site citable. It is here because IDE
// agents and MCP clients do fetch it, that audience is exactly this package's,
// and a site shipping a "Truss as AI context" guide without one would be odd.
//
// Generated rather than hand-maintained, so a new docs page cannot be forgotten.

const entry = (id, title, description) => ({ id, data: { title, description } })

describe('sectionOf', () => {
  it('places a page by its top directory', () => {
    expect(sectionOf('guides/authorization')).toBe('Guides')
    expect(sectionOf('getting-started/installation')).toBe('Getting started')
    expect(sectionOf('reference/commands')).toBe('Reference')
    expect(sectionOf('help/troubleshooting')).toBe('Help')
  })

  it('puts a page with no directory under Optional', () => {
    // The llms.txt spec treats an Optional section as secondary material an
    // agent may skip. Credits and the privacy page are exactly that.
    expect(sectionOf('credits')).toBe('Optional')
    expect(sectionOf('privacy')).toBe('Optional')
  })

  it('ignores the file extension the content collection carries', () => {
    // Starlight's collection ids keep the extension: "guides/theming.mdx", not
    // "guides/theming". Left alone it produced URLs like /guides/theming.mdx/,
    // every one of them a 404.
    expect(sectionOf('guides/theming.mdx')).toBe('Guides')
    expect(sectionOf('credits.mdx')).toBe('Optional')
    expect(sectionOf('help/troubleshooting.md')).toBe('Help')
  })

  it('puts an unrecognised directory under Optional rather than dropping it', () => {
    // Losing a page silently is the failure this generator exists to prevent.
    expect(sectionOf('something-new/page')).toBe('Optional')
  })
})

describe('groupIntoSections', () => {
  const entries = [
    entry('guides/theming', 'Theming', 'Match the app'),
    entry('getting-started/installation', 'Installation', 'Install it'),
    entry('guides/authorization', 'Authorization', 'Gate access'),
    entry('credits', 'Credits', 'Thanks'),
  ]
  const sections = groupIntoSections('https://trussphp.com', entries)

  it('orders sections the way a reader meets them, not alphabetically', () => {
    expect(sections.map((section) => section.heading)).toEqual([
      'Getting started',
      'Guides',
      'Optional',
    ])
  })

  it('omits a section with no pages', () => {
    expect(sections.map((section) => section.heading)).not.toContain('Reference')
  })

  it('sorts pages within a section by title, so the output is stable', () => {
    const guides = sections.find((section) => section.heading === 'Guides')
    expect(guides.links.map((link) => link.title)).toEqual(['Authorization', 'Theming'])
  })

  it('builds absolute trailing-slash URLs matching the built routes', () => {
    const guides = sections.find((section) => section.heading === 'Guides')
    expect(guides.links[0].url).toBe('https://trussphp.com/guides/authorization/')
  })

  it('strips the extension from the URL too', () => {
    const withExtensions = groupIntoSections('https://trussphp.com', [
      entry('guides/theming.mdx', 'Theming', 'Match the app'),
    ])
    expect(withExtensions[0].links[0].url).toBe('https://trussphp.com/guides/theming/')
  })

  it('keeps every entry it was given', () => {
    const total = sections.reduce((sum, section) => sum + section.links.length, 0)
    expect(total).toBe(entries.length)
  })
})

describe('renderLlmsTxt', () => {
  const output = renderLlmsTxt({
    title: 'Laravel Truss',
    summary: 'A live database structure viewer for Laravel.',
    intro: 'Structure only, never data.',
    sections: [
      {
        heading: 'Guides',
        links: [
          { title: 'Authorization', url: 'https://trussphp.com/guides/authorization/', description: 'Gate access' },
          { title: 'Theming', url: 'https://trussphp.com/guides/theming/' },
        ],
      },
    ],
  })

  it('opens with a single H1, as the format requires', () => {
    expect(output.split('\n')[0]).toBe('# Laravel Truss')
    expect(output.match(/^# /gm)).toHaveLength(1)
  })

  it('carries the summary as a blockquote directly under the title', () => {
    expect(output).toContain('> A live database structure viewer for Laravel.')
  })

  it('renders each section as an H2 with a link list', () => {
    expect(output).toContain('## Guides')
    expect(output).toContain('- [Authorization](https://trussphp.com/guides/authorization/): Gate access')
  })

  it('omits the trailing colon when a page has no description', () => {
    expect(output).toContain('- [Theming](https://trussphp.com/guides/theming/)\n')
    expect(output).not.toContain('Theming](https://trussphp.com/guides/theming/):')
  })

  it('ends with exactly one newline', () => {
    expect(output.endsWith('\n')).toBe(true)
    expect(output.endsWith('\n\n')).toBe(false)
  })
})

describe('renderLlmsFullTxt', () => {
  const output = renderLlmsFullTxt({
    title: 'Laravel Truss',
    summary: 'A live database structure viewer for Laravel.',
    pages: [
      { title: 'Installation', url: 'https://trussphp.com/getting-started/installation/', body: '## Requirements\n\nPHP 8.3' },
      { title: 'Theming', url: 'https://trussphp.com/guides/theming/', body: 'Colours.' },
    ],
  })

  it('carries the whole body of every page, not just an index', () => {
    expect(output).toContain('PHP 8.3')
    expect(output).toContain('Colours.')
  })

  it('names each page and where it came from, so a quote can be attributed', () => {
    expect(output).toContain('# Installation')
    expect(output).toContain('https://trussphp.com/getting-started/installation/')
  })

  it('separates pages so two documents cannot read as one', () => {
    expect(output).toContain('\n---\n')
  })
})
