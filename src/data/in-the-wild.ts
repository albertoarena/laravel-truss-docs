/**
 * Coverage of Truss written by other people. Single source for the
 * /in-the-wild page.
 *
 * One test decides every row: was it written by somebody other than Alberto,
 * without being asked? Both halves are required, and the domain is only a cheap
 * proxy for the first. So the Laravel News editorial is in and a Laravel News
 * Links entry is not, because a link submitted by the author and approved by an
 * editor is a filter rather than a decision to write about it. Issues opened by
 * users are in even though the repository is Alberto's: authorship decides, not
 * the domain.
 *
 * This is the PUBLIC curation only. The private planning notes rank people by
 * how they behaved and hold a reach figure per comment. None of that is
 * inferable from here, and that includes the ordering: rows sort by date, never
 * by how well somebody performed.
 *
 * Nothing on this page may be written from recollection. Every field comes from
 * the source it links to, which is why a row without a URL is not a row.
 */

/**
 * Sources seen so far. Open by design: the next one is somebody's blog.
 *
 * Written as a const array rather than a union in the interface because
 * `'Laravel News' | ... | string` collapses to `string` and the literals stop
 * doing anything. The intersection below keeps both the suggestions and the
 * freedom.
 */
export const SOURCES = ['Laravel News', 'Laravel Daily', 'LinkedIn', 'X', 'GitHub'] as const

/**
 * Fields holding text written by somebody else and reproduced word for word.
 *
 * Exported because the house style scan imports it: this repo forbids em dashes
 * and en dashes in its own prose, other people use them, and editing a quote to
 * fit our punctuation is the failure this whole page exists to avoid. The scan
 * exempts these fields and nothing else in this file. See
 * tests/content-rules.test.js.
 *
 * Adding a fourth verbatim field to Mention means adding it here, or the scan
 * will start correcting somebody's words.
 */
export const VERBATIM_FIELDS = ['quote', 'translation', 'role'] as const

/**
 * Longest quote that still reads as a pull-quote rather than a reprint.
 *
 * Also a courtesy to the person quoted: past this, take the sense of what they
 * said and link to the rest.
 */
export const QUOTE_MAX = 300

export type Kind = 'press' | 'community' | 'report'

export interface Mention {
  kind: Kind
  /** Verbatim. Never tidied, never translated silently. */
  quote?: string
  /** BCP-47, when the quote is not English. Renders as lang= on the blockquote. */
  quoteLang?: string
  /** Ours, shown under a non-English quote and labelled as a translation. */
  translation?: string
  author: string
  /** Only what the source itself shows. Never inferred from a bio. */
  role?: string
  source: (typeof SOURCES)[number] | (string & {})
  url: string
  /** ISO, for sorting. Rendered spelled out, so 10/08 cannot be read as 08/10. */
  date: string
  /**
   * The release that answered a report. Required on `report` rows.
   *
   * Without it the page publishes a list of bugs in Truss with no visible
   * resolution, on the product's own site, and a reader who skips the section
   * blurb sees only the bugs. It cannot live in `quote`: a quote is verbatim
   * from something written before the release existed.
   *
   * Deliberately NOT in VERBATIM_FIELDS. This one is our own text, so house
   * style applies to it exactly as it does everywhere else.
   */
  fixedIn?: string
  /**
   * Why this may be shown. Required, and never rendered.
   *
   * Linking a public post and quoting a line from it with attribution is
   * ordinary practice. Lifting a sentence into a pull-quote presented as an
   * endorsement is a different thing, and the standard here is to ask first.
   * Requiring the field means a testimonial cannot be added without somebody
   * deciding which of the two it is.
   *
   * Be clear about what a passing test proves: that somebody typed a value, not
   * that permission exists. It is a speed bump that forces a decision, and that
   * is worth having, but it is not evidence and must never later be read as
   * proof that an ask was made.
   */
  basis: 'public-post' | 'permission-given'
}

export interface Section {
  kind: Kind
  label: string
  blurb: string
}

/**
 * Three, in this order, because that is the order the reader's trust is built:
 * somebody chose to write about it, people who used it said things, and the
 * things they reported got fixed.
 */
export const SECTIONS: Section[] = [
  {
    kind: 'press',
    label: 'Written about Truss',
    blurb: 'Editorial and newsletter placements, decided by somebody else.',
  },
  {
    kind: 'community',
    label: 'What people say',
    blurb: 'Developers who installed it, in their own words.',
  },
  {
    kind: 'report',
    label: 'Reported and fixed',
    blurb: 'Problems users found, and the releases that answered them.',
  },
]

/**
 * Sources that are Alberto writing, however they are dressed up.
 *
 * A URL check is the cheap half of the authorship test and this list is the
 * deny side of it; the expensive half is the author field, which must never be
 * the maintainer's own name. Matching is by host, optionally narrowed to a path
 * prefix where only part of a domain is self-authored.
 *
 * Two entries fail safe on purpose. dev.to and medium.com are denied whole
 * because Truss content there is syndication of Alberto's own posts, so if a
 * third party ever writes about it on either, this rule blocks the row and
 * somebody has to come and change it deliberately. That is the right way round:
 * a blocked real row costs an edit, a published self-authored quote cannot be
 * walked back.
 *
 * LinkedIn and X are deliberately absent. They are the bulk of the genuine set,
 * and the author check is what keeps Alberto's own posts out of it.
 */
export interface SelfAuthored {
  host: string
  /** When only part of the domain is his. Matched as a path prefix. */
  path?: string
  why: string
}

export const SELF_AUTHORED: SelfAuthored[] = [
  { host: 'trussphp.com', why: 'This site, which is the same author quoting himself' },
  { host: 'albertoarena.it', why: 'Same author' },
  { host: 'dev.to', why: 'Syndicated from albertoarena.it' },
  { host: 'medium.com', why: 'Syndicated from albertoarena.it' },
  {
    host: 'laravel-news.com',
    path: '/links/',
    why: 'Self-submitted. An editor approving a link is a filter, not a decision to write about it',
  },
  { host: 'freek.dev', path: '/links/', why: 'Submitted, not sought' },
  {
    host: 'github.com',
    path: '/albertoarena/laravel-truss/blob/',
    why: 'The README and the shipped docs are the same author',
  },
  {
    host: 'github.com',
    path: '/albertoarena/laravel-truss/tree/',
    why: 'The README and the shipped docs are the same author',
  },
  { host: 'ko-fi.com', path: '/albertoarena', why: 'Same author' },
  { host: 'youtube.com', path: '/@AlbertoArenaDev', why: 'Same author' },
]

/**
 * The published set. Chosen privately, transcribed here, never composed here.
 *
 * Every field below came off the artefact it links to. Nothing was written from
 * recollection, and nothing was inferred from a bio: the roles are absent
 * because no source showed one, not because nobody looked.
 *
 * Most rows ship with no quote, on purpose. The template renders a quote as a
 * pull-quote above the attribution, which presents it as an endorsement, and
 * that is the case the rules say to ask permission for first. A row with no
 * quote renders as an attributed link and needs nobody's agreement. The two
 * exceptions are published editorial and public bug reports.
 *
 * Sorted by date within each section and by nothing else. How a post performed
 * stays in the private notes, including as an ordering.
 */
export const MENTIONS: Mention[] = [
  {
    kind: 'press',
    // Double quotes because the sentence contains an apostrophe. The apostrophe
    // is the ASCII one, checked against the page source rather than assumed:
    // verbatim covers which character it is.
    // Long line, left long: a verbatim field has to stay on one line or the
    // style scan's carve-out cannot blank it, and the punctuation in somebody
    // else's sentence starts failing the build.
    // prettier-ignore
    quote: "It reads structure only, meaning tables, columns, keys, and indexes, and never queries row data, so you don't need to point an external GUI client at the database or regenerate a static diagram every time you run a migration.",
    author: 'Yannick Lyn Fatt',
    source: 'Laravel News',
    url: 'https://laravel-news.com/laravel-truss-database-er-diagrams',
    date: '2026-08-10',
    basis: 'public-post',
  },
  {
    // Povilas is the author and Laravel Daily is the source, not the reverse:
    // his own public copy reads "My new video on Laravel Daily channel", which
    // is the visible basis for attributing it to the person.
    //
    // youtube.com is on the deny list above, but only under /@AlbertoArenaDev,
    // so a /watch URL passes. That narrowing is deliberate, not an oversight.
    kind: 'press',
    author: 'Povilas Korop',
    source: 'Laravel Daily',
    url: 'https://www.youtube.com/watch?v=zogsFocamlU',
    date: '2026-08-10',
    basis: 'public-post',
  },

  // Community rows: all LinkedIn, all public posts, all quoteless by the rule
  // above. Dates are decoded from the LinkedIn snowflake ID in each URL
  // (id >> 22 is a Unix millisecond timestamp), a method checked against a post
  // whose time had been recorded independently before it was relied on here.
  {
    kind: 'community',
    author: 'Mohamed Said',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7492777380558852097/',
    date: '2026-08-11',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Haydar Ali Awan',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7492848896029732864/',
    date: '2026-08-11',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Haseeb Mirza',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7492942932958892033/',
    date: '2026-08-11',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Danial Qamar',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7493252446715211776/',
    date: '2026-08-12',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Mohammad Shuvo Talukder',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7493316602453544960/',
    date: '2026-08-12',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Amr Lotfy Saleh',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7493611779424423936/',
    date: '2026-08-13',
    basis: 'public-post',
  },
  // Waleed Ahmad is held back, and it is the only row that is. The URN decodes
  // to 13/08 and the private notes logged the post as "~1d old" when read on
  // 17/08. Both cannot be true, and the page prints the date, so shipping
  // either would be publishing a fact about somebody's post that nobody has
  // checked. Open the post, read the date off it, then uncomment.
  // {
  //   kind: 'community',
  //   author: 'Waleed Ahmad',
  //   source: 'LinkedIn',
  //   url: 'https://www.linkedin.com/feed/update/urn:li:share:7493752588404916225/',
  //   date: 'CONFIRM AGAINST THE POST',
  //   basis: 'public-post',
  // },
  {
    kind: 'community',
    author: 'Bhavin Vaghadiya',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7493977387634892800/',
    date: '2026-08-14',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Mohammad Ghanem',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/posts/mohammad-ghanem-901108186_laravel-php-laraveltips-share-7494400677201424385--oas/',
    date: '2026-08-15',
    basis: 'public-post',
  },
  {
    kind: 'community',
    author: 'Ahmed Fawzy',
    source: 'LinkedIn',
    url: 'https://www.linkedin.com/posts/ahmed-fawzy10_laravel-truss-is-a-very-useful-package-you-share-7494813912908079104-oM7H/',
    date: '2026-08-16',
    basis: 'public-post',
  },

  // Reported and fixed. Names are the GitHub profile display names, from the
  // API rather than guessed off the handle. Each release is sourced from its own
  // release notes naming the fix, not from the dates lining up, which would be a
  // correlation dressed as a fact. All three were opened and shipped the same
  // day, which is the argument this section makes.
  {
    kind: 'report',
    author: 'Santos Sabanari',
    source: 'GitHub',
    url: 'https://github.com/albertoarena/laravel-truss/issues/3',
    date: '2026-07-28',
    fixedIn: 'v1.3.1',
    basis: 'public-post',
  },
  {
    kind: 'report',
    author: 'Nguyễn Tiến Lộc',
    source: 'GitHub',
    url: 'https://github.com/albertoarena/laravel-truss/issues/46',
    date: '2026-08-12',
    fixedIn: 'v1.8.3',
    basis: 'public-post',
  },
  {
    kind: 'report',
    author: 'Hafiz Muhammad Moaz',
    source: 'GitHub',
    url: 'https://github.com/albertoarena/laravel-truss/issues/51',
    date: '2026-08-17',
    fixedIn: 'v1.8.4',
    basis: 'public-post',
  },
]
