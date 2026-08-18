/**
 * Curation rules for the /in-the-wild page, as functions.
 *
 * Pure and data-in/data-out, like scripts/faq.js and scripts/structured-data.js,
 * so the rules can be asserted directly rather than by scraping the built HTML.
 * The page imports the grouping and the formatting; the test suite imports the
 * validator and runs it against fixtures, which is what gives the rules teeth
 * while the published set is still empty.
 */

import { AUTHOR_NAME } from '../config/package.js'
import { QUOTE_MAX, SELF_AUTHORED } from '../data/in-the-wild.ts'

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
 */
export function shouldCollapse(mentions, threshold = 3) {
  const count = (kind) => mentions.filter((m) => m.kind === kind).length
  return count('press') < threshold || count('community') < threshold
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
