/**
 * Put the hand-authored pages under public/ into the sitemap.
 *
 * Starlight builds the sitemap from its own content collections, so the demo,
 * its multi-connection variant and the theme builder were simply absent: 18
 * URLs, none of them the three pages people actually share. Search engines
 * found them by following links, which is slower and lower priority than being
 * declared, and it is why they were the last pages to settle after the
 * canonical fix in Search Console.
 *
 * Appended to the built sitemap rather than declared through a second sitemap
 * integration, because Starlight owns the one that runs and configuring a rival
 * alongside it invites two sitemaps disagreeing. Same reasoning, and the same
 * astro:build:done hook, as the head metadata these pages already get.
 *
 * The list comes from STATIC_PAGES, so a fourth static page cannot be added to
 * the metadata and forgotten here.
 */

import { STATIC_PAGES } from './static-page-meta.mjs'

/** Absolute URL per hand-authored page, on whatever origin the build targets. */
export function staticPageUrls(site) {
  const origin = String(site).replace(/\/$/, '')

  return STATIC_PAGES.map((page) => `${origin}${page.path}`)
}

const escapeXml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')

/**
 * Add the URLs the sitemap is missing, immediately before its closing tag.
 *
 * Anything already listed is skipped, which keeps this idempotent across a
 * rebuild over an existing dist/ and means nothing breaks on the day Starlight
 * starts emitting these itself. A duplicated <loc> is an invalid sitemap.
 *
 * A sitemap without a recognisable </urlset> is returned untouched: shipping
 * the URLs that already work beats corrupting the file over three additions.
 */
export function addUrls(xml, urls) {
  if (!xml.includes('</urlset>')) return xml

  const missing = urls.filter((url) => !xml.includes(`<loc>${escapeXml(url)}</loc>`))
  if (missing.length === 0) return xml

  const block = missing.map((url) => `<url><loc>${escapeXml(url)}</loc></url>`).join('')

  return xml.replace('</urlset>', `${block}</urlset>`)
}
