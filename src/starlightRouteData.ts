/**
 * Gives the FAQ page the table of contents Starlight cannot build for it.
 *
 * Starlight derives the contents from markdown headings. The FAQ's questions are
 * h2s rendered by a component, so it sees none of them and the page shipped with
 * the nav switched off: the only page on the site without one, and every
 * question unlinkable.
 *
 * The entries are derived from the same data the page renders, so they cannot
 * describe a heading that is not there.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data'

import { FAQ } from './data/faq.ts'
import { faqToc } from './scripts/faq.js'

export const onRequest = defineRouteMiddleware((context) => {
  const { starlightRoute } = context.locals
  if (!starlightRoute.entry.data.faq) return

  starlightRoute.toc = {
    minHeadingLevel: 2,
    maxHeadingLevel: 2,
    items: faqToc(FAQ),
  }
})
