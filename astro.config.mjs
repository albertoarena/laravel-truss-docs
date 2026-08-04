import { readFile, writeFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import starlight from '@astrojs/starlight'

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
      ],
      social: {
        github: 'https://github.com/albertoarena/laravel-truss',
      },
      editLink: {
        baseUrl: 'https://github.com/albertoarena/laravel-truss-docs/edit/main/',
      },
      components: {
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
            { label: 'Troubleshooting', link: '/help/troubleshooting/' },
          ],
        },
        { label: 'Credits', link: '/credits/' },
      ],
    }),
    demoAssetVersioning(),
  ],
})
