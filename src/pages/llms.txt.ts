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
import { DEMO_APPS, appPagePath } from '../../scripts/demo-apps.mjs'
import { PACKAGE_NAME } from '../config/package.js'

const SUMMARY =
  'A live database structure viewer for Laravel. Scans your live schema and renders it as a scrollable, zoomable ER diagram inside your app.'

const INTRO =
  'Structure only, never data: tables, columns, indexes and foreign keys are read, row contents are never queried or exposed. Requires PHP 8.2+ and Laravel 12+. Source at https://github.com/albertoarena/laravel-truss.'

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
    title: 'Draw your own schema',
    path: '/demo/your-schema/',
    description:
      'Paste a mysqldump taken with no data, or a Truss JSON export, and see your own tables drawn. Parsed in the browser, never uploaded',
  },
  {
    title: 'Theme builder',
    path: '/theme-builder/',
    description: 'Build a palette against a live preview and copy the config it produces',
  },
  // One per application in /demo/apps/: a real open-source Laravel schema drawn
  // in the dashboard, from a static snapshot.
  //
  // Listed because this file holds every built route bar the landing and the
  // roadmap, and a test asserts it (llms-txt-output). That invariant is the
  // point: a page an agent cannot find in the index may as well not be there,
  // and a page deliberately absent from it is a claim that needs its own
  // reason. Derived from the registry, so the twentieth application arrives
  // here without anyone remembering this file.
  ...DEMO_APPS.map((app) => ({
    title: `${app.name}'s database structure`,
    path: appPagePath(app),
    description:
      `${app.tables} tables and ${app.foreignKeys} foreign keys of the open-source ${app.name} `
      + `codebase, drawn as an ER diagram. A snapshot taken ${app.snapshot} from ${app.repository}, `
      + `which is ${app.licence} licensed. Structure only: no row data is read or shown`,
  })),
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
