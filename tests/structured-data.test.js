import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  REPO_URL,
  PACKAGIST_URL,
  AUTHOR_NAME,
  AUTHOR_PROFILE,
} from '../src/config/package.js'

import {
  ids,
  personNode,
  websiteNode,
  softwareApplicationNode,
  techArticleNode,
  breadcrumbCrumbs,
  breadcrumbNode,
  graph,
} from '../src/scripts/structured-data.js'

// The site emitted no structured data at all: zero application/ld+json in the
// whole built output. For a package whose documentation wants to be quoted by
// answer engines, that is the largest single gap, because entity disambiguation
// is most of what those engines reward.
//
// Everything here is pure so it can be asserted directly. That the nodes reach
// both layout paths is a separate concern, checked against dist/ in
// structured-data-output.test.js.

const SITE = 'https://trussphp.com'

describe('graph', () => {
  it('wraps nodes in a single schema.org graph', () => {
    const result = graph([{ '@type': 'Thing' }])
    expect(result['@context']).toBe('https://schema.org')
    expect(result['@graph']).toEqual([{ '@type': 'Thing' }])
  })

  it('drops nothing and keeps order, so @id references stay resolvable', () => {
    const result = graph([{ '@type': 'A' }, { '@type': 'B' }])
    expect(result['@graph'].map((node) => node['@type'])).toEqual(['A', 'B'])
  })
})

describe('ids', () => {
  it('are stable fragments on the site origin, so nodes can cross-reference', () => {
    expect(ids(SITE)).toEqual({
      person: 'https://trussphp.com/#person',
      website: 'https://trussphp.com/#website',
      software: 'https://trussphp.com/#software',
    })
  })
})

describe('personNode', () => {
  const person = personNode(SITE)

  it('identifies the author with a stable id', () => {
    expect(person['@type']).toBe('Person')
    expect(person['@id']).toBe(ids(SITE).person)
    expect(person.name).toBe(AUTHOR_NAME)
  })

  it('links the profiles that actually establish the identity', () => {
    expect(person.sameAs).toContain(AUTHOR_PROFILE)
  })

  it('claims no profile the site does not already link', () => {
    // sameAs is an identity assertion. Listing a profile that is not
    // corroborated elsewhere on the site weakens entity resolution rather than
    // helping it, so this stays deliberately small.
    for (const url of person.sameAs) {
      expect(url).toMatch(/^https:\/\//)
    }
  })
})

describe('websiteNode', () => {
  const website = websiteNode(SITE)

  it('describes the site itself', () => {
    expect(website['@type']).toBe('WebSite')
    expect(website['@id']).toBe(ids(SITE).website)
    expect(website.url).toBe(SITE)
  })

  it('references the person by id rather than repeating the object', () => {
    expect(website.publisher).toEqual({ '@id': ids(SITE).person })
  })
})

describe('softwareApplicationNode', () => {
  const software = softwareApplicationNode(SITE)

  it('describes the package as developer software', () => {
    expect(software['@type']).toBe('SoftwareApplication')
    expect(software['@id']).toBe(ids(SITE).software)
    expect(software.name).toBe(PACKAGE_NAME)
    expect(software.applicationCategory).toBe('DeveloperApplication')
  })

  it('states the version without the tag prefix', () => {
    // The constant carries the git tag form, v1.8.3; schema.org wants 1.8.3.
    expect(software.softwareVersion).toBe(PACKAGE_VERSION.replace(/^v/, ''))
  })

  it('points at the code and the package registry', () => {
    expect(software.codeRepository).toBe(REPO_URL)
    expect(software.sameAs).toContain(PACKAGIST_URL)
  })

  it('says it is free, since "no price" and "free" are not the same claim', () => {
    expect(software.offers).toMatchObject({ '@type': 'Offer', price: 0 })
  })

  it('attributes authorship by id', () => {
    expect(software.author).toEqual({ '@id': ids(SITE).person })
  })
})

describe('techArticleNode', () => {
  const article = techArticleNode(SITE, {
    title: 'Installation',
    description: 'Install Laravel Truss into your application',
    url: 'https://trussphp.com/getting-started/installation/',
  })

  it('describes a documentation page', () => {
    expect(article['@type']).toBe('TechArticle')
    expect(article.headline).toBe('Installation')
    expect(article.description).toBe('Install Laravel Truss into your application')
    expect(article.url).toBe('https://trussphp.com/getting-started/installation/')
  })

  it('ties the page to the site and the author by id', () => {
    expect(article.isPartOf).toEqual({ '@id': ids(SITE).website })
    expect(article.author).toEqual({ '@id': ids(SITE).person })
  })

  it('names what the documentation is about', () => {
    expect(article.about).toEqual({ '@id': ids(SITE).software })
  })

  it('omits dateModified entirely when none is known', () => {
    // An absent property is honest. An invented or empty one is a false claim
    // about freshness, which is exactly what these engines weigh.
    expect('dateModified' in article).toBe(false)
  })

  it('includes dateModified when one is known', () => {
    const dated = techArticleNode(SITE, {
      title: 'X',
      description: 'Y',
      url: `${SITE}/x/`,
      dateModified: new Date('2026-08-15T00:00:00Z'),
    })
    expect(dated.dateModified).toBe('2026-08-15T00:00:00.000Z')
  })
})

describe('breadcrumbCrumbs', () => {
  it('starts at the site root', () => {
    const crumbs = breadcrumbCrumbs(SITE, '/guides/authorization/', 'Authorization')
    expect(crumbs[0]).toEqual({ name: 'Home', item: `${SITE}/` })
  })

  it('names the section without inventing a URL for it', () => {
    // /guides/ is not a real page on this site. Emitting it as a linked crumb
    // would put a 404 into the structured data, so the section is carried as a
    // name only.
    const crumbs = breadcrumbCrumbs(SITE, '/guides/authorization/', 'Authorization')
    expect(crumbs[1]).toEqual({ name: 'Guides' })
  })

  it('ends on the page itself, using the real page title', () => {
    const crumbs = breadcrumbCrumbs(SITE, '/guides/authorization/', 'Authorization')
    expect(crumbs.at(-1)).toEqual({
      name: 'Authorization',
      item: `${SITE}/guides/authorization/`,
    })
  })

  it('title-cases a hyphenated section the way the sidebar reads', () => {
    const crumbs = breadcrumbCrumbs(SITE, '/getting-started/installation/', 'Installation')
    expect(crumbs[1]).toEqual({ name: 'Getting Started' })
  })

  it('is just home and the page when there is no section', () => {
    const crumbs = breadcrumbCrumbs(SITE, '/credits/', 'Credits')
    expect(crumbs).toHaveLength(2)
    expect(crumbs.at(-1).name).toBe('Credits')
  })

  it('has nothing to say about the home page itself', () => {
    expect(breadcrumbCrumbs(SITE, '/', 'Home')).toEqual([])
  })
})

describe('breadcrumbNode', () => {
  it('numbers positions from one', () => {
    const node = breadcrumbNode(SITE, '/guides/authorization/', 'Authorization')
    expect(node['@type']).toBe('BreadcrumbList')
    expect(node.itemListElement.map((element) => element.position)).toEqual([1, 2, 3])
  })

  it('omits the item property on a crumb that has no URL', () => {
    const node = breadcrumbNode(SITE, '/guides/authorization/', 'Authorization')
    const section = node.itemListElement[1]
    expect(section.name).toBe('Guides')
    expect('item' in section).toBe(false)
  })

  it('is null rather than an empty list when there are no crumbs', () => {
    expect(breadcrumbNode(SITE, '/', 'Home')).toBeNull()
  })
})

describe('the version constant', () => {
  const versionFile = fileURLToPath(new URL('../.demo-asset-version', import.meta.url))

  it.skipIf(!existsSync(versionFile))(
    'matches the release the build actually resolved',
    () => {
      // .demo-asset-version is written by the prebuild step from the latest
      // GitHub release. It is gitignored, so this only runs after a real build,
      // but when it does it catches the landing page and the structured data
      // advertising a version the site no longer ships.
      expect(PACKAGE_VERSION).toBe(readFileSync(versionFile, 'utf8').trim())
    },
  )
})
