/**
 * Head metadata for the hand-authored pages under public/.
 *
 * The demo, its multi-connection variant and the theme builder are copied
 * verbatim into the build, so they never pass through SiteLayout or Starlight
 * and inherit nothing from either. They shipped with a <title> and, on one of
 * them, a description. No canonical, no OpenGraph, no Twitter card. They are
 * also the most engaging pages on the site and the ones most likely to be
 * shared, so a link to them rendered as a bare URL with no image or summary.
 *
 * Injected at build time rather than written into the three source files,
 * matching what astro.config.mjs already does to these same pages for asset
 * versioning and the consent banner. The origin then comes from the build, so a
 * preview build does not emit canonicals pointing at production, and the copy
 * lives in one place instead of three.
 */

/** One entry per hand-authored page. `file` is relative to the build output. */
export const STATIC_PAGES = [
  {
    file: 'demo/index.html',
    path: '/demo/',
    title: 'Laravel Truss: live demo',
    description:
      'Try the Laravel Truss dashboard in your browser against a sample schema. A scrollable, zoomable ER diagram with focus mode, filtering and exports, needing no installation and no database.',
  },
  {
    file: 'demo/multi-connection/index.html',
    path: '/demo/multi-connection/',
    title: 'Laravel Truss: multiple connections demo',
    description:
      'The Laravel Truss dashboard across more than one database connection, running live in your browser. Switch between connections and see each schema drawn on its own.',
  },
  {
    file: 'theme-builder/index.html',
    path: '/theme-builder/',
    title: 'Laravel Truss: theme builder',
    description:
      'Build a Truss theme in the browser and copy the config it produces. Dial in colours and fonts against a live dashboard preview, with no installation needed.',
  },
]

/** Attribute-safe. A stray quote in a description would otherwise end the attribute. */
const attr = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

export function metaTags({ site, page, cover }) {
  const url = `${site.replace(/\/$/, '')}${page.path}`

  return [
    `<meta name="description" content="${attr(page.description)}">`,
    `<link rel="canonical" href="${url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${attr(page.title)}">`,
    `<meta property="og:description" content="${attr(page.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${cover}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:image" content="${cover}">`,
  ].join('\n    ')
}

const MARKER = '<!-- static page meta -->'

/**
 * Put the tags in the head, exactly once.
 *
 * Any description the page already carried is dropped first: two descriptions
 * is worse than either, because which one wins is up to whatever is reading.
 * A page with no head is returned untouched rather than guessed at.
 */
export function injectMeta(html, tags) {
  if (!html.includes('</head>')) return html
  if (html.includes(MARKER)) return html

  return html
    .replace(/[ \t]*<meta\s+name="description"[^>]*>\n?/gi, '')
    .replace('</head>', `  ${MARKER}\n    ${tags}\n  </head>`)
}
