/**
 * schema.org nodes for the site, as plain data.
 *
 * Before this the built output contained no application/ld+json at all, which
 * for documentation that wants to be quoted by answer engines is the largest
 * single gap: entity disambiguation is most of what those engines reward.
 *
 * Everything here is pure and returns objects, so it can be asserted directly
 * rather than by scraping HTML. Two things consume it, because this site renders
 * through two layout paths that share no head: SiteLayout.astro for the landing
 * and the roadmap, and the Starlight Head override for every docs page. A node
 * added to only one of them reaches only half the site.
 *
 * Nodes cross-reference by @id rather than repeating each other. One Person
 * object exists per page; the website, the package and every article point at it.
 */

import {
  PACKAGE_NAME,
  PACKAGE_VERSION,
  REPO_URL,
  PACKAGIST_URL,
  LICENSE_URL,
  AUTHOR_NAME,
  AUTHOR_PROFILE,
} from '../config/package.js'

/** Stable fragment identifiers, so references resolve across pages. */
export const ids = (site) => ({
  person: `${site}/#person`,
  website: `${site}/#website`,
  software: `${site}/#software`,
})

export const graph = (nodes) => ({
  '@context': 'https://schema.org',
  '@graph': nodes,
})

export const personNode = (site) => ({
  '@type': 'Person',
  '@id': ids(site).person,
  name: AUTHOR_NAME,
  url: site,
  sameAs: [AUTHOR_PROFILE],
})

export const websiteNode = (site) => ({
  '@type': 'WebSite',
  '@id': ids(site).website,
  url: site,
  name: `${PACKAGE_NAME} documentation`,
  publisher: { '@id': ids(site).person },
})

export const softwareApplicationNode = (site) => ({
  '@type': 'SoftwareApplication',
  '@id': ids(site).software,
  name: PACKAGE_NAME,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Any',
  softwareVersion: PACKAGE_VERSION.replace(/^v/, ''),
  codeRepository: REPO_URL,
  license: LICENSE_URL,
  programmingLanguage: 'PHP',
  url: site,
  sameAs: [PACKAGIST_URL],
  author: { '@id': ids(site).person },
  // Stated explicitly: an absent offer says nothing about price, while this
  // says the thing is free, which is a fact worth being able to answer.
  offers: { '@type': 'Offer', price: 0, priceCurrency: 'EUR' },
})

/**
 * One documentation page.
 *
 * dateModified is omitted rather than defaulted when unknown. An absent property
 * is honest; an invented one is a false freshness claim, and freshness is
 * something these engines weigh.
 */
export function techArticleNode(site, { title, description, url, dateModified }) {
  const node = {
    '@type': 'TechArticle',
    headline: title,
    description,
    url,
    isPartOf: { '@id': ids(site).website },
    author: { '@id': ids(site).person },
    about: { '@id': ids(site).software },
  }

  if (dateModified) node.dateModified = new Date(dateModified).toISOString()

  return node
}

/**
 * A FAQPage, built from the same strings the page renders.
 *
 * The answer text is carried verbatim rather than summarised. Marking up
 * something other than what a reader sees is what gets a FAQPage ignored, and
 * generating both from one source is the only way to be sure they agree.
 *
 * Null for an empty list: an FAQPage with no questions is worse than none.
 */
export function faqNode(site, items) {
  if (items.length === 0) return null

  return {
    '@type': 'FAQPage',
    '@id': `${site}/help/faq/#faq`,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  }
}

/**
 * Coverage by other people, as an ItemList of CreativeWork.
 *
 * No Review and no AggregateRating, ever. Self-serving review markup on your
 * own product page is against Google's own guidance, and a score synthesised out
 * of LinkedIn comments would be a number this project cannot source, which is
 * the same failure mode as claiming a conformance level nobody audited. An
 * ItemList pointing at the real URLs is honest, and it is all an answer engine
 * needs to follow the trail to the people who actually said these things.
 *
 * Ordering is declared descending because the page sorts by date and by nothing
 * else. How well somebody's post performed is in the private notes and never
 * reaches this file, including as a sort order.
 *
 * Null for an empty list, like faqNode: an ItemList with no items says nothing.
 */
export function mentionsNode(site, pathname, mentions) {
  if (mentions.length === 0) return null

  return {
    '@type': 'ItemList',
    '@id': `${site}${pathname}#mentions`,
    name: `Coverage of ${PACKAGE_NAME} by other people`,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    numberOfItems: mentions.length,
    itemListElement: mentions.map((mention, i) => {
      const work = {
        '@type': 'CreativeWork',
        url: mention.url,
        datePublished: mention.date,
        author: { '@type': 'Person', name: mention.author },
        publisher: { '@type': 'Organization', name: mention.source },
        about: { '@id': ids(site).software },
      }

      // Only what the source shows, and only in the language it was written in.
      if (mention.quote) work.text = mention.quote
      if (mention.quoteLang) work.inLanguage = mention.quoteLang

      return { '@type': 'ListItem', position: i + 1, item: work }
    }),
  }
}

const titleCase = (segment) =>
  segment
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')

/**
 * Home, then the section, then the page.
 *
 * The section carries a name and no URL on purpose. Sections like /guides/ are
 * sidebar groupings, not pages, so linking them would put a 404 into the
 * structured data. schema.org permits a ListItem with a name alone, and a
 * hierarchy that is honest beats one that is clickable and wrong.
 */
export function breadcrumbCrumbs(site, pathname, title) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return []

  const crumbs = [{ name: 'Home', item: `${site}/` }]

  for (const segment of segments.slice(0, -1)) {
    crumbs.push({ name: titleCase(segment) })
  }

  crumbs.push({ name: title, item: `${site}${pathname}` })

  return crumbs
}

/** Null rather than an empty list: a breadcrumb of nothing is not worth emitting. */
export function breadcrumbNode(site, pathname, title) {
  const crumbs = breadcrumbCrumbs(site, pathname, title)
  if (crumbs.length === 0) return null

  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, index) => {
      const element = { '@type': 'ListItem', position: index + 1, name: crumb.name }
      if (crumb.item) element.item = crumb.item
      return element
    }),
  }
}
