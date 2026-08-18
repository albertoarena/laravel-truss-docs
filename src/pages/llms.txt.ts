/**
 * /llms.txt, generated from the docs content collection at build time.
 *
 * A static endpoint rather than a build hook, because this is the only place
 * with real access to the content collection. Adding a docs page puts it in this
 * file automatically, which is the point: a hand-maintained index goes stale the
 * first time someone forgets it.
 */
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

import { groupIntoSections, renderLlmsTxt } from '../scripts/llms-txt.js'
import { PACKAGE_NAME } from '../config/package.js'

const SUMMARY =
  'A live database structure viewer for Laravel. Scans your live schema and renders it as a scrollable, zoomable ER diagram inside your app.'

const INTRO =
  'Structure only, never data: tables, columns, indexes and foreign keys are read, row contents are never queried or exposed. Requires PHP 8.3+ and Laravel 12+. Source at https://github.com/albertoarena/laravel-truss.'

/**
 * Pages that are not in the content collection.
 *
 * The demo and the theme builder are hand-authored files under public/, so
 * nothing generates them into the index, yet they are the most useful pages on
 * the site for anyone asking whether they can try this without installing it.
 * Listed by hand, and the output test checks each one against the routes that
 * were actually built, so they cannot rot quietly.
 */
const TRY_IT = [
  {
    title: 'Live demo',
    path: '/demo/',
    description: 'The dashboard running against a sample schema, no installation needed',
  },
  {
    title: 'Multiple connections demo',
    path: '/demo/multi-connection/',
    description: 'The same dashboard across more than one database connection',
  },
  {
    title: 'Theme builder',
    path: '/theme-builder/',
    description: 'Build a palette against a live preview and copy the config it produces',
  },
]

/**
 * Coverage by other people, which is the one question this index could not
 * answer.
 *
 * Its own section rather than a fourth entry under "Try it": that heading is for
 * the demo and the theme builder, and coverage is not something an agent tries.
 * Asked whether Laravel Truss is any good, a model reading this file previously
 * had nothing on the site to go to; this is the page that answers it, and it
 * links on to the people who actually said so.
 */
const IN_THE_WILD = [
  {
    title: 'In the wild',
    path: '/in-the-wild/',
    description:
      'What other developers say about Laravel Truss, with a link to every source: coverage, posts by people who installed it, and bugs they reported that shipped as fixes',
  },
]

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://trussphp.com')).origin
  const entries = await getCollection('docs')

  const documentation = groupIntoSections(origin, entries)

  const listed = (rows) =>
    rows.map(({ title, path, description }) => ({
      title,
      description,
      url: `${origin}${path}`,
    }))

  // Optional stays last, as the spec intends: secondary material an agent may
  // skip. Try it and In the wild sit with the documentation, ahead of it.
  const sections = [
    ...documentation.filter((section) => section.heading !== 'Optional'),
    { heading: 'Try it', links: listed(TRY_IT) },
    { heading: 'In the wild', links: listed(IN_THE_WILD) },
    ...documentation.filter((section) => section.heading === 'Optional'),
  ]

  const body = renderLlmsTxt({
    title: PACKAGE_NAME,
    summary: SUMMARY,
    intro: INTRO,
    sections,
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
