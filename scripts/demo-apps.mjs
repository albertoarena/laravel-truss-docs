/**
 * The per-application demo pages under /demo/apps/.
 *
 * Each one renders a real open-source Laravel application's schema in the
 * actual Truss dashboard, from a static snapshot exported with
 * `truss:export --format=json --no-annotations`. The shell is hand-authored
 * HTML under public/, the same way the other demo pages are.
 *
 * This array exists because those other pages are named in four separate
 * hard-coded lists: the asset-version rewrite and the consent banner in
 * astro.config.mjs, STATIC_PAGES in static-page-meta.mjs (which also drives the
 * sitemap), and SHELLS in tests/demo-shell.test.js. Adding a twentieth
 * application by editing four lists is a promise to forget one, and the one
 * that matters fails silently: a page missing from the rewrite points at
 * demo/assets/, which the build has already renamed to assets-<version>/, so it
 * renders perfectly in `npm run dev` and shows an empty diagram in production.
 * Every list now derives from here instead.
 *
 * `focus` is the table the page lands on, at depth 1. Not decoration: a 67
 * table first paint is slow and unreadable, and a focused landing is also the
 * only demonstration of the searchable Focus picker anywhere on the site. The
 * table is asserted to exist in the schema, so a rename cannot leave the page
 * landing on nothing.
 *
 * Pick it for what a reader arriving from a search would look for first, and
 * then check the zoom in a browser, because the two can disagree. The fit scale
 * is set by the tallest table in the focused set rather than by how many tables
 * are in it, so a set holding one 29 column table fits at 30% and is unreadable
 * while a set of the same size with shorter tables fits at 45%. Where they
 * disagree, keep the table a reader wants and let the page's zoom floor clamp
 * the landing to something legible: a first paint too small to read discourages
 * the reader the page exists for, which matters more than being able to survey
 * the whole schema in one view.
 *
 * `tables` is the count this snapshot actually holds, which is NOT the count
 * the field study reports for the same application. Truss excludes Laravel's
 * own scaffolding, and for Lunar that is exactly eight tables (cache,
 * cache_locks, failed_jobs, job_batches, jobs, migrations,
 * password_reset_tokens, sessions), so the diagram shows 67 where
 * /reference/tested-applications/ reports 75. Both are true and they are
 * different claims, so the page says which one it means and a test checks the
 * number against the file.
 */
export const DEMO_APPS = [
  {
    slug: 'lunar',
    name: 'Lunar',
    // The count in this snapshot. See the note above before changing it.
    tables: 67,
    foreignKeys: 83,
    // What /reference/tested-applications/ reports for the same application,
    // and the tables that account for the difference. Both are here so the
    // reconciliation is arithmetic a test can run rather than a sentence on a
    // page, because "the gap is just scaffolding" is the kind of claim that
    // stays in the prose long after it stops being true.
    //
    // Checked on one database rather than inferred across two runs, which is
    // the trap: `lunar_truss_local` holds 75 tables, the export holds 67, and
    // the eight below are exactly the difference by name. The field study's row
    // is from 21/08 against an older Lunar, so that could have been two numbers
    // from two checkouts; it is not, because no Schema::create migration exists
    // in the package after that date (2026_08_26 is an alter), so the table
    // count did not move in between.
    fieldStudyTables: 75,
    excludedTables: [
      'cache', 'cache_locks', 'failed_jobs', 'job_batches', 'jobs',
      'migrations', 'password_reset_tokens', 'sessions',
    ],
    focus: 'lunar_products',
    repository: 'https://github.com/lunarphp/core',
    licence: 'MIT',
    // Read from the harness checkout's composer.lock, not from memory: the
    // reference table records "1.x" for Lunar, which is not a version this page
    // can print.
    version: '1.5.0',
    commit: 'd93b23e',
    laravel: '12.68.0',
    snapshot: '02/09/2026',
    title: "Lunar's database structure, drawn by Laravel Truss",
    description:
      "Lunar's 67 tables and 83 foreign keys, rendered live as an ER diagram by Laravel Truss. A static snapshot of the open-source e-commerce package's schema, focusable and zoomable in your browser.",
  },
]

/** Build-output path of one app page, relative to the build root. */
export const appPageFile = (app) => `demo/apps/${app.slug}/index.html`

/** Public URL of one app page. */
export const appPagePath = (app) => `/demo/apps/${app.slug}/`

/**
 * The relative token each app page uses to reach the shared demo assets.
 *
 * Two levels up, because /demo/apps/<slug>/ is one level deeper than
 * /demo/multi-connection/. The build's rewrite matches these tokens literally,
 * so this is the string both sides have to agree on.
 */
export const APP_ASSET_TOKEN = '../../assets/'
