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
 * The rows themselves are generated, not written here.
 *
 * `markstone:in-the-wild:export` writes this file from the private tracker,
 * where every row already carries the decision to publish it and the reason.
 * Transcribing them by hand is what this replaces: on 19/08/2026 the same
 * coverage row carried three different dates across three files, and the one a
 * person typed was the wrong one.
 *
 * **Nothing measured can arrive through here.** The exporter names the fields
 * it emits rather than serialising a row, so a metric added to the tracker
 * cannot reach this page by inheritance, and the order is by date because any
 * other order publishes a ranking without printing a number.
 *
 * The type below is still the contract, and the tests still run over the real
 * array. A generated file that does not satisfy `problemsWith()` fails the
 * build the same way a hand-written one would.
 *
 * One consequence worth naming: verbatim quotes now live in JSON, which the
 * house-style scan does not walk. That is the safer side of the line. The scan
 * exists to keep our own prose free of em dashes, and it must never be in a
 * position to correct somebody else's sentence.
 */
import generated from './in-the-wild.generated.json'

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
   * How long the report waited, opened to the release that answered it.
   *
   * Coarse text from the exporter, e.g. "1h 44m". Opened-to-release rather than
   * opened-to-closed because it is the only interval consistent with `fixedIn`
   * sitting beside it: publishing the shorter one next to a version number
   * implies a release that did not exist yet, which is two true facts making a
   * false one.
   *
   * This measures Alberto's own responsiveness, not the person who reported the
   * bug, which is why it does not touch the rule against publishing anything
   * measured. Not required: a report may legitimately have no release yet.
   */
  fixedAfter?: string
  /**
   * Why this may be shown. Required, and never rendered.
   *
   * **Revised 19/08/2026, when the page moved from testimonials to citation.**
   * A short attributed excerpt of something somebody published publicly, linked
   * to its source, is ordinary practice and needs no permission: that is what
   * quoting is. The earlier standard here was to ask first, which was the right
   * answer while the template rendered every quote as a pull-quote looming above
   * the attribution, because that presents an excerpt as an endorsement. The
   * template cites now, so `public-post` carries the whole public set.
   *
   * **`permission-given` is therefore reserved for sources that are not public**,
   * where a link cannot stand on its own: a direct message, a Discord post, a
   * private report. If a row carries it, there should be no public URL that would
   * have done instead.
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
 * Heading used when the first two sections render as one list.
 *
 * See shouldCollapse in scripts/in-the-wild.js: below six rows between them, two
 * thin sections read worse than one solid one. Not in use at the current set,
 * which has twelve. Lives here rather than in the template because it is a
 * label, and labels are content.
 */
export const COLLAPSED: Omit<Section, 'kind'> = {
  label: 'What people say',
  blurb: 'Written by other people, unprompted, and linked to the source.',
}

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
export const MENTIONS: Mention[] = generated as Mention[]
