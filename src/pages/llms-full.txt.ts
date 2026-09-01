/**
 * /llms-full.txt: every documentation page in full, in one fetch.
 *
 * For an agent that would otherwise pull seventeen URLs. Each page keeps its
 * title and canonical URL so a passage taken from here can still be attributed
 * back to the page it came from.
 *
 * Credits and privacy are left out. They are the Optional section of llms.txt,
 * secondary material an agent may skip, and padding a grounding document with a
 * cookie policy makes it worse rather than more complete.
 *
 * /in-the-wild/ is left out for the same reason, deliberately and not by
 * oversight: this file is the documentation collection rendered in full, and
 * coverage by other people is not documentation. It is listed in llms.txt, which
 * is the index an agent uses to decide what to fetch, so nothing is hidden;
 * reproducing other people's words inside a grounding document would only invite
 * them to be quoted without the link that makes them checkable.
 */
import type { APIRoute } from 'astro'
import { getCollection } from 'astro:content'

import { renderLlmsFullTxt, sectionOf, routeIdOf } from '../scripts/llms-txt.js'
import { PACKAGE_NAME } from '../config/package.js'

const SUMMARY =
  'Full documentation for Laravel Truss, a live database structure viewer for Laravel. Structure only, never data.'

export const GET: APIRoute = async ({ site }) => {
  const origin = (site ?? new URL('https://trussphp.com')).origin

  const entries = (await getCollection('docs'))
    .filter((entry) => sectionOf(entry.id) !== 'Optional')
    .sort((a, b) => a.id.localeCompare(b.id))

  const body = renderLlmsFullTxt({
    title: PACKAGE_NAME,
    summary: SUMMARY,
    pages: entries.map((entry) => ({
      title: entry.data.title,
      url: `${origin}/${routeIdOf(entry.id)}/`,
      body: entry.body ?? '',
    })),
  })

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
