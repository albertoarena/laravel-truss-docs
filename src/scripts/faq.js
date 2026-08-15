/**
 * Anchors and table of contents for the FAQ.
 *
 * Starlight derives both from markdown headings, and the questions are h2s
 * rendered by a component, so it can see neither. The page first shipped with
 * the contents switched off, which left it the only page on the site without an
 * "On this page" nav and made every question unlinkable.
 *
 * Both are therefore derived here from the same data the page renders, and a
 * route middleware hands the result to Starlight. Deriving rather than hand
 * writing the ids means a reworded question cannot leave a stale anchor behind,
 * and the tests check they stay unique and fragment-safe.
 */

/** Starlight's own id for the page title anchor. */
const PAGE_TITLE_ID = '_top'

/**
 * A question as a URL fragment: lowercase, punctuation dropped rather than
 * escaped, runs of separators collapsed.
 */
export const questionId = (question) =>
  question
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

/**
 * The contents list, in the shape Starlight expects: a flat set of h2 entries
 * behind the Overview link it puts at the top of every page.
 */
export const faqToc = (items) => [
  { depth: 2, slug: PAGE_TITLE_ID, text: 'Overview', children: [] },
  ...items.map((item) => ({
    depth: 2,
    slug: questionId(item.question),
    text: item.question,
    children: [],
  })),
]
