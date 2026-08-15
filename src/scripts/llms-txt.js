/**
 * The llms.txt index, built from the docs content collection.
 *
 * Written here rather than taken from a plugin. The obvious dependency,
 * starlight-llms-txt, has moved on to Astro 6 and 7 and only fits this repo at a
 * version four minors behind, which would have meant a dependency frozen until a
 * major framework upgrade. This site has seventeen pages and already carries two
 * custom build hooks, so generating the file locally costs less than owning that.
 *
 * Worth being clear about what this buys. No major provider has committed to
 * consuming llms.txt and measured bot traffic to it is negligible, so it is not
 * what makes the site citable. It is here because IDE agents and MCP clients do
 * fetch it, that is exactly this package's audience, and a site that ships a
 * "Truss as AI context" guide without one would be odd.
 *
 * Generated, never hand-maintained: a new docs page cannot be forgotten, and
 * tests assert every page in the collection reaches the file.
 */

/** Sidebar order, because that is the order a reader meets the material. */
export const SECTIONS = [
  { dir: 'getting-started', heading: 'Getting started' },
  { dir: 'guides', heading: 'Guides' },
  { dir: 'reference', heading: 'Reference' },
  { dir: 'help', heading: 'Help' },
]

/**
 * Which section a page belongs to, from its top directory.
 *
 * Anything unrecognised falls into Optional rather than being dropped. The spec
 * treats Optional as secondary material an agent may skip, which is right for
 * credits and privacy, and losing a page silently is the failure this generator
 * exists to prevent.
 */
export function sectionOf(id) {
  const [dir, ...rest] = id.split('/')
  if (rest.length === 0) return 'Optional'
  return SECTIONS.find((section) => section.dir === dir)?.heading ?? 'Optional'
}

const ORDER = [...SECTIONS.map((section) => section.heading), 'Optional']

/**
 * Collection ids keep the source extension: "guides/theming.mdx". The route does
 * not. Left in, every URL in this file pointed at a 404.
 */
export const routeIdOf = (id) => id.replace(/\.mdx?$/, '')

export function groupIntoSections(site, entries) {
  const byHeading = new Map()

  for (const entry of entries) {
    const heading = sectionOf(entry.id)
    if (!byHeading.has(heading)) byHeading.set(heading, [])
    byHeading.get(heading).push({
      title: entry.data.title,
      description: entry.data.description,
      url: `${site}/${routeIdOf(entry.id)}/`,
    })
  }

  return ORDER.filter((heading) => byHeading.has(heading)).map((heading) => ({
    heading,
    // Sorted by title rather than left in collection order, so the file is
    // stable between builds and a diff means a real change.
    links: byHeading.get(heading).sort((a, b) => a.title.localeCompare(b.title)),
  }))
}

const linkLine = ({ title, url, description }) =>
  description ? `- [${title}](${url}): ${description}` : `- [${title}](${url})`

/** https://llmstxt.org: one H1, a blockquote summary, then H2 link sections. */
export function renderLlmsTxt({ title, summary, intro, sections }) {
  const parts = [`# ${title}`, '', `> ${summary}`]

  if (intro) parts.push('', intro)

  for (const section of sections) {
    parts.push('', `## ${section.heading}`, '')
    parts.push(...section.links.map(linkLine))
  }

  return `${parts.join('\n')}\n`
}

/**
 * Every page in full, for an agent that would otherwise fetch seventeen URLs.
 *
 * Each page keeps its title and canonical URL so a passage lifted from here can
 * still be attributed, and pages are separated by a rule so two documents cannot
 * be read as one continuous text.
 */
export function renderLlmsFullTxt({ title, summary, pages }) {
  const parts = [`# ${title}`, '', `> ${summary}`, '']

  for (const page of pages) {
    parts.push('', '---', '', `# ${page.title}`, '', `Source: ${page.url}`, '', page.body.trim())
  }

  return `${parts.join('\n')}\n`
}
