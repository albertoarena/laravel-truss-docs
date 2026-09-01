/**
 * Curation rules for the /in-the-wild page, as functions.
 *
 * Pure and data-in/data-out, like scripts/faq.js and scripts/structured-data.js,
 * so the rules can be asserted directly rather than by scraping the built HTML.
 * The page imports the grouping and the formatting; the test suite imports the
 * validator and runs it over both the published rows and a fixture set built to
 * break them, because a rule that has only ever passed is not known to work.
 *
 * Worth knowing before trusting any of it: problemsWith is called from the test
 * suite and from nowhere else. `npm test` rejects a bad row and `astro build`
 * will happily ship one, so these rules are exactly as strong as CI running on
 * the pull request.
 */

import { AUTHOR_NAME } from '../config/package.js'
import { COLLAPSED, QUOTE_MAX, SELF_AUTHORED } from '../data/in-the-wild.ts'

/** Trailing-dot and www differences should not decide an authorship question. */
const normaliseHost = (host) => host.replace(/^www\./, '').replace(/\.$/, '')

/**
 * The self-authored entry a URL matches, or null.
 *
 * Subdomain-aware: a post on notes.albertoarena.it is the same author as one on
 * albertoarena.it, and a rule that missed that would be a rule in name only.
 */
export function selfAuthoredMatch(url, list = SELF_AUTHORED) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }

  const host = normaliseHost(parsed.hostname)

  return (
    list.find((entry) => {
      const target = normaliseHost(entry.host)
      const hostMatches = host === target || host.endsWith(`.${target}`)
      if (!hostMatches) return false
      return entry.path ? parsed.pathname.startsWith(entry.path) : true
    }) ?? null
  )
}

/**
 * Everything wrong with a row, in plain sentences, or an empty array.
 *
 * One function rather than a list of assertions in the test file, because these
 * rules also want to be readable by whoever is pasting in the next row.
 */
export function problemsWith(mention, kinds = ['press', 'community', 'report']) {
  const problems = []
  const label = mention?.author || mention?.url || 'row'

  if (!mention || typeof mention !== 'object') return [`${label}: not a row`]

  if (!mention.author) problems.push(`${label}: no author`)
  if (!mention.url) problems.push(`${label}: no URL, so it cannot be checked`)
  if (!mention.basis) problems.push(`${label}: no permission basis`)
  if (!mention.source) problems.push(`${label}: no source`)
  if (!kinds.includes(mention.kind)) problems.push(`${label}: kind "${mention.kind}" has no section`)

  if (mention.author && mention.author.trim().toLowerCase() === AUTHOR_NAME.toLowerCase()) {
    problems.push(`${label}: written by the maintainer, which is the one thing this page is not`)
  }

  const self = mention.url ? selfAuthoredMatch(mention.url) : null
  if (self) problems.push(`${label}: ${self.host} is excluded. ${self.why}`)

  if (mention.url && !/^https:\/\//.test(mention.url)) {
    problems.push(`${label}: URL is not https`)
  }

  if (mention.quote && mention.quote.length > QUOTE_MAX) {
    problems.push(
      `${label}: quote is ${mention.quote.length} characters, over ${QUOTE_MAX}. A pull-quote is not a reprint`,
    )
  }

  if (mention.translation && !mention.quoteLang) {
    problems.push(`${label}: a translation without quoteLang, so nothing says what it was translated from`)
  }

  if (mention.quoteLang && !mention.quote) {
    problems.push(`${label}: quoteLang without a quote`)
  }

  if (mention.date && Number.isNaN(Date.parse(mention.date))) {
    problems.push(`${label}: date "${mention.date}" does not parse`)
  }
  if (!mention.date) problems.push(`${label}: no date`)

  if (mention.kind === 'report' && !mention.fixedIn) {
    problems.push(
      `${label}: no release, and a report with no fix has no business in a section called "Reported and fixed"`,
    )
  }

  return problems
}

/** Newest first. The only ordering this page has, and deliberately so. */
export const byDateDescending = (a, b) => Date.parse(b.date) - Date.parse(a.date)

/** Sections in trust order, each carrying its own rows, empty ones dropped. */
export function bySection(mentions, sections) {
  return sections
    .map((section) => ({
      ...section,
      items: mentions.filter((m) => m.kind === section.kind).sort(byDateDescending),
    }))
    .filter((section) => section.items.length > 0)
}

/**
 * Whether the press and community sections should render as one list.
 *
 * Decided in advance rather than left to taste on the day: three sections with
 * two rows each reads worse than one section with six. "Reported and fixed"
 * stands alone regardless, because it is different evidence.
 *
 * **Measures the two sections together, not each one separately.** It counted
 * them separately at first, which did not match the reason above: with two press
 * rows and ten community ones the page is not thin, but a per-section rule sees
 * `2 < 3`, merges anyway, and sorts the merged list by date. The editorial is
 * the oldest row in the set, so the strongest thing on the page ended up at the
 * bottom of it. Lowering the number would have fixed that one set and broken
 * again at a single press row; counting the volume that actually decides whether
 * the page looks thin does not.
 *
 * Keeping press separate is not a ranking leak. Sections are keyed on `kind`,
 * which is a category, not a measure of how anything performed.
 */
export function shouldCollapse(mentions, threshold = 6) {
  const together = mentions.filter(
    (m) => m.kind === 'press' || m.kind === 'community',
  ).length

  return together < threshold
}

/**
 * What the page actually renders: three sections, or two once the first pair is
 * collapsed.
 *
 * "Reported and fixed" is never merged into the others. It is different
 * evidence: not what somebody thought of the package, but what they hit and
 * what shipped because of it.
 */
export function sectionsFor(mentions, sections, collapsed = COLLAPSED) {
  if (!shouldCollapse(mentions)) return bySection(mentions, sections)

  const merged = mentions
    .filter((m) => m.kind === 'press' || m.kind === 'community')
    .sort(byDateDescending)

  return [
    ...(merged.length ? [{ kind: 'community', ...collapsed, items: merged }] : []),
    ...bySection(mentions, sections.filter((s) => s.kind === 'report')),
  ]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * "10 Aug 2026".
 *
 * Spelled out because the audience is largely non-native English and
 * concentrated outside Europe and the US, and 10/08 against 08/10 is the one
 * ambiguity worth four characters to remove. UTC, so a build machine's timezone
 * cannot move a date by a day.
 */
export function formatDate(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/**
 * Up to two initials.
 *
 * No avatars and no publisher logos anywhere on this page: hotlinking
 * LinkedIn's CDN rots and leaks the visitor to a third party, and reproducing a
 * publisher's mark is a permission question nobody needs to open.
 */
export function initialsOf(author) {
  return (author || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => [...part][0].toUpperCase())
    .join('')
}

/** Scripts written right to left, for `dir` on a quote in one of them. */
const RTL = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'sd', 'yi'])

/** Whether a BCP-47 tag needs dir="rtl". Matches on the language subtag. */
export const isRtl = (tag) => RTL.has(String(tag || '').split('-')[0].toLowerCase())

/**
 * "Arabic", from "ar".
 *
 * Used to label a translation as ours, which is the part that must never be
 * ambiguous: the English on this page is not what the person wrote. Falls back
 * to the tag itself rather than throwing, since a label is not worth a build.
 */
export function languageName(tag, locale = 'en') {
  if (!tag) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(tag) || tag
  } catch {
    return tag
  }
}

/**
 * Whether a source URL points at a video, so the link can say so.
 *
 * All this drives is a small triangle before the source name. An earlier version
 * built a click-to-load facade with a self-hosted poster, which was correct on
 * privacy and wrong on everything else: the embed rendered badly, the poster
 * made one card twice the height of its neighbour, and the whole apparatus
 * existed to give a reader something they get by clicking the link.
 *
 * Dropping it removes the privacy question rather than solving it. A link
 * requests nothing until it is followed, which is what /privacy/ has always
 * said about YouTube.
 */
export function isVideo(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host === 'youtube.com' || host === 'youtu.be'
  } catch {
    return false
  }
}

/**
 * Matches one verbatim field assigned a single-line string literal.
 *
 * Used twice, from one definition. The style scan uses it to blank these lines
 * before looking for em dashes, and the in-the-wild suite uses it to insist that
 * every verbatim field really is on one line, which is what makes the blanking
 * reliable without parsing TypeScript. A template literal spanning lines would
 * slip a quote past the scan in one direction and past the reader in the other.
 */
export function verbatimFieldLine(fields) {
  return new RegExp(`^\\s*(?:${fields.join('|')}):\\s*(['"]).*\\1,?\\s*$`)
}

/** Any line that opens a verbatim field, however it is assigned. */
export function verbatimFieldStart(fields) {
  return new RegExp(`^\\s*(?:${fields.join('|')}):`)
}
