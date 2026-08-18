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
export const SOURCES = ['Laravel News', 'LinkedIn', 'X', 'GitHub'] as const

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
 * The published set.
 *
 * Empty until the candidate list is assembled privately, with a URL and a
 * permission basis for every row. It stays empty rather than being seeded with
 * plausible-looking examples: an invented testimonial on a public site is the
 * one failure here that cannot be walked back. The rules above are exercised
 * against tests/fixtures/in-the-wild.js in the meantime, so they are known to
 * work before the first real row lands.
 */
export const MENTIONS: Mention[] = []
