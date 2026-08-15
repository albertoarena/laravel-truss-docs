import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'
import { consentSnippet } from './scripts/consent-snippet.mjs'

// Cache-bust the live demo's frontend: at build, move the copied assets into a
// version-stamped folder and repoint the demo HTML at it, so a new package
// release changes every asset URL. A version-stamped folder (rather than a
// `?v=` query) is used because the demo is an ES-module app: truss.js imports
// its siblings (./selection.js, ./diff-view.js) and truss.css references its
// fonts relatively, and those sub-requests inherit the folder, which a query
// string on the entry points could not reach. Only the built output is
// rewritten; the committed source keeps plain ./assets/ for local dev.
function demoAssetVersioning() {
  return {
    name: 'demo-asset-versioning',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        let version = 'dev'
        try {
          version = (await readFile(new URL('./.demo-asset-version', import.meta.url), 'utf8')).trim() || 'dev'
        } catch { /* no version file: fall back to a stable folder name */ }
        const safe = version.replace(/[^A-Za-z0-9._-]/g, '-')
        const demoDir = join(fileURLToPath(dir), 'demo')
        try {
          await rename(join(demoDir, 'assets'), join(demoDir, `assets-${safe}`))
          // Repoint every page that references the demo assets at the versioned
          // folder. The demo's top-level page uses ./assets/; pages nested one
          // level deep (multi-connection/) use ../assets/; the theme builder, a
          // sibling of demo/, links the demo stylesheet as ../demo/assets/. Each
          // gets the same version stamp.
          const rewrites = [
            { page: join(demoDir, 'index.html'), find: ['./assets/', '../assets/'] },
            { page: join(demoDir, 'multi-connection', 'index.html'), find: ['./assets/', '../assets/'] },
            { page: join(fileURLToPath(dir), 'theme-builder', 'index.html'), find: ['../demo/assets/'] },
          ]
          for (const { page, find } of rewrites) {
            try {
              let html = await readFile(page, 'utf8')
              for (const token of find) {
                html = html.replaceAll(token, token.replace('assets/', `assets-${safe}/`))
              }
              await writeFile(page, html)
            } catch (e) {
              logger.warn(`Skipped repointing ${page}: ${e.message}`)
            }
          }
          logger.info(`Versioned demo assets as assets-${safe}`)
        } catch (e) {
          logger.warn(`Skipped demo asset versioning: ${e.message}`)
        }
      },
    },
  }
}

// Put the consent banner on the hand-authored static pages.
//
// The demo, its multi-connection variant and the theme builder live under
// public/ and are copied verbatim, so they never render through SiteLayout or
// the Starlight footer override and carried neither banner nor analytics. That
// left the most engaged page on the site unmeasured, and made anyone who
// accepted elsewhere look like they had bounced.
//
// Injected into the built output only, so the committed source stays clean and
// local development keeps working without a measurement ID. With no ID the
// snippet is empty: no tag, so nothing to consent to.
function staticPageConsent() {
  return {
    name: 'static-page-consent',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const snippet = consentSnippet(process.env.PUBLIC_GA_MEASUREMENT_ID)
        if (!snippet) {
          logger.info('No measurement ID: static pages left without a consent banner')
          return
        }

        const pages = [
          join(fileURLToPath(dir), 'demo', 'index.html'),
          join(fileURLToPath(dir), 'demo', 'multi-connection', 'index.html'),
          join(fileURLToPath(dir), 'theme-builder', 'index.html'),
        ]

        let injected = 0
        for (const page of pages) {
          try {
            const html = await readFile(page, 'utf8')
            if (html.includes('id="cookie-consent"')) continue
            if (!html.includes('</body>')) {
              logger.warn(`No </body> in ${page}, consent banner not injected`)
              continue
            }
            await writeFile(page, html.replace('</body>', `${snippet}</body>`))
            injected++
          } catch (e) {
            logger.warn(`Skipped consent injection for ${page}: ${e.message}`)
          }
        }
        logger.info(`Consent banner injected into ${injected} static page(s)`)
      },
    },
  }
}

// Wrap every Markdown table in a scrollable, keyboard-reachable region.
//
// The reference tables are wider than a phone column. Left alone they overflow
// a parent that cannot scroll, so at 320px roughly 39px of the last column is
// cut off and unreachable: a 1.4.10 Reflow failure that loses content rather
// than merely looking cramped. A wrapper with `overflow-x: auto` restores it.
//
// The wrapper is focusable and named on purpose. A region that scrolls only
// under a mouse would trade a Reflow failure for a Keyboard one, so it takes
// `tabindex="0"` (Tab reaches it, arrow keys scroll it) plus a role and a label,
// so it is announced as something navigable rather than an unexplained stop.
//
// A rehype plugin rather than CSS, because there is no CSS-only way to add a
// wrapper element, and the obvious alternative (`display: block` on the table
// itself) drops the CSS table layout, which some assistive technology uses to
// decide whether it is a real table. Fixing reflow by breaking table semantics
// would be a poor trade.
function rehypeScrollableTables() {
  return (tree) => {
    const visit = (node) => {
      if (!node.children) return
      node.children = node.children.map((child) => {
        visit(child)
        if (child.type !== 'element' || child.tagName !== 'table') return child
        return {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['table-scroll'],
            tabIndex: 0,
            role: 'region',
            'aria-label': 'Table, scrollable',
          },
          children: [child],
        }
      })
    }
    visit(tree)
  }
}

// Build target is env-driven. The default is the production root domain
// (trussphp.com); SITE_URL / SITE_BASE let CI or a preview build target
// elsewhere. SITE_BASE uses ?? so an explicit '' still means "root, no subpath".
const SITE = process.env.SITE_URL || 'https://trussphp.com'
const BASE = process.env.SITE_BASE ?? ''
const COVER = `${SITE}${BASE}/cover-light.png`

export default defineConfig({
  site: SITE,
  base: BASE || undefined,
  integrations: [
    starlight({
      title: 'Laravel Truss',
      description: 'A live database structure viewer for Laravel',
      logo: {
        light: './src/assets/truss-mark-light.svg',
        dark: './src/assets/truss-mark-dark.svg',
      },
      favicon: '/favicon.svg',
      head: [
        // Preload the mono family so it is in place before first paint. Paired
        // with font-display: optional in tokens.css, this is what keeps the text
        // from re-measuring and shifting the layout (CLS). These pages render
        // through Starlight's own layout, not SiteLayout, so they need their own
        // copy of the preloads that SiteLayout's head already carries.
        ...['400', '500', '600'].map((weight) => ({
          tag: 'link',
          attrs: {
            rel: 'preload',
            href: `/fonts/ibm-plex-mono-${weight}.woff2`,
            as: 'font',
            type: 'font/woff2',
            // Explicitly 'anonymous': fonts are always fetched in CORS mode, and
            // a preload whose crossorigin does not match the real fetch is
            // downloaded twice. (crossorigin: true would render the invalid
            // value "true", which browsers coerce to anonymous anyway, but the
            // keyword says what is meant.)
            crossorigin: 'anonymous',
          },
        })),
        { tag: 'meta', attrs: { property: 'og:image', content: COVER } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: '1200' } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: '630' } },
        { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: COVER } },
        // Cloudflare Web Analytics beacon (cookieless, no consent banner). The
        // token is public, not a secret. Manual install because the domain is
        // grey-cloud (DNS-only), so Cloudflare cannot auto-inject it.
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://static.cloudflareinsights.com/beacon.min.js',
            'data-cf-beacon': '{"token": "7f6eaa0832eb43cc838db8d337590f11"}',
          },
        },
        // Only the table wrappers that actually scroll should be tab stops.
        // The markup ships focusable (see rehypeScrollableTables): that is the
        // safe default, because a scrolling region no keyboard can reach is a
        // real barrier, while a spare tab stop is only noise. But most tables
        // fit at desktop width, and announcing a region and consuming a Tab for
        // each of them is noise a screen reader user does not need, so drop it
        // where there is nothing to scroll, and re-check when the width changes.
        {
          tag: 'script',
          content: `(function(){
  function sync(){
    document.querySelectorAll('.table-scroll').forEach(function(el){
      if (el.scrollWidth > el.clientWidth) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'region');
      } else {
        el.removeAttribute('tabindex');
        el.removeAttribute('role');
      }
    });
  }
  if (document.readyState !== 'loading') sync();
  else document.addEventListener('DOMContentLoaded', sync);
  addEventListener('resize', sync);
})();`,
        },
      ],
      social: {
        github: 'https://github.com/albertoarena/laravel-truss',
      },
      editLink: {
        baseUrl: 'https://github.com/albertoarena/laravel-truss-docs/edit/main/',
      },
      // Supplies the FAQ page's table of contents, which Starlight cannot
      // derive because those headings are rendered by a component.
      routeMiddleware: './src/starlightRouteData.ts',
      components: {
        // Wraps Starlight's own Head to add the schema.org graph. Docs pages
        // never render through SiteLayout, so without this the structured data
        // would cover only the landing and the roadmap.
        Head: './src/components/overrides/Head.astro',
        SiteTitle: './src/components/overrides/SiteTitle.astro',
        Header: './src/components/overrides/Header.astro',
        Footer: './src/components/overrides/Footer.astro',
        ThemeSelect: './src/components/overrides/ThemeSelect.astro',
      },
      customCss: [
        './src/styles/tokens.css',
        './src/styles/custom.css',
      ],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Home', link: '/' },
            { label: 'Installation', link: '/getting-started/installation/' },
            { label: 'Quick start', link: '/getting-started/quick-start/' },
            { label: 'Live demo', link: '/demo/', attrs: { target: '_blank' }, badge: 'Live' },
            { label: 'Theme builder', link: '/theme-builder/', attrs: { target: '_blank' }, badge: 'New' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Authorization', link: '/guides/authorization/' },
            { label: 'Focus & filter', link: '/guides/focus-and-filter/' },
            { label: 'Schema diff', link: '/guides/schema-diff/' },
            { label: 'Schema doctor', link: '/guides/schema-doctor/' },
            { label: 'Schema export', link: '/guides/schema-export/' },
            { label: 'Truss as AI context', link: '/guides/ai-context/', badge: 'New' },
            { label: 'MCP server', link: '/guides/mcp-server/', badge: 'New' },
            { label: 'Theming', link: '/guides/theming/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration', link: '/reference/configuration/' },
            { label: 'Commands', link: '/reference/commands/' },
          ],
        },
        {
          label: 'Help',
          items: [
            { label: 'FAQ', link: '/help/faq/' },
            { label: 'Troubleshooting', link: '/help/troubleshooting/' },
          ],
        },
        { label: 'Credits', link: '/credits/' },
      ],
    }),
    demoAssetVersioning(),
    staticPageConsent(),
  ],
  markdown: {
    rehypePlugins: [rehypeScrollableTables],
  },
})
