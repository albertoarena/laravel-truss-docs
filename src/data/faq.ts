/**
 * The FAQ, as data.
 *
 * Single source for the /help/faq/ page and for the FAQPage structured data it
 * emits, following the same pattern as roadmap.ts. One source matters more here
 * than elsewhere: marking up an answer that differs from the one on the page is
 * what gets a FAQPage ignored, so the markup and the visible text are generated
 * from the same strings and a test asserts they stay identical.
 *
 * The rule for this file: no answer may introduce a claim the documentation does
 * not already make. Every entry carries the page it came from, a test requires
 * it, and the wording is kept close to the source. The site is otherwise
 * task-shaped ("Installation", "Configuration") and answers no question
 * directly, which is the gap this fills.
 *
 * Answers are kept under about eighty words on purpose. An answer an engine has
 * to truncate is one it will paraphrase instead, and a paraphrase is where the
 * errors come from.
 */

export interface FaqItem {
  question: string
  /** Plain text. Rendered as the visible answer and used verbatim in the markup. */
  answer: string
  /** The documentation page this answer is drawn from. */
  source: string
}

export const FAQ: FaqItem[] = [
  {
    question: 'Does Laravel Truss expose my data?',
    answer:
      'No. Truss reads structure only, never row data: tables, columns, indexes and foreign keys. Row contents are never queried or exposed. The boundary is the CREATE TABLE definition, so column defaults and native table comments count as structure and are in scope, while the rows themselves are not. Every export, image and diagram follows the same rule.',
    source: '/guides/ai-context/',
  },
  {
    question: 'Is Laravel Truss safe to run in production?',
    answer:
      'Yes. It is designed to be installed in production and gated there by two independent layers, both of which must pass. Note that running on a non-local server requires installing it as a regular dependency rather than a dev one, because a --dev install is stripped from composer install --no-dev deploys and the route would return 404.',
    source: '/guides/authorization/',
  },
  {
    question: 'How is access to the Truss dashboard controlled?',
    answer:
      'By two layers. truss.enabled is the deploy switch and defaults to the local environment only, so a production deploy stays dark until you set TRUSS_ENABLED=true. The fixed viewTruss gate is the access control, consulted only outside local. Both failure modes return 404 rather than 403, so the dashboard never confirms it exists to someone who may not view it.',
    source: '/guides/authorization/',
  },
  {
    question: 'What PHP and Laravel versions does Laravel Truss require?',
    answer:
      'PHP 8.3 or higher and Laravel 12 or higher. Install it with composer require albertoarena/laravel-truss --dev for local use. The service provider is auto-discovered, and there is nothing to publish to get started. Publishing the config to config/truss.php is optional, and every option has a sensible default.',
    source: '/getting-started/installation/',
  },
  {
    question: 'Which databases does Laravel Truss support?',
    answer:
      'It reads through Laravel native schema introspection rather than a separate driver layer, so it follows what your Laravel connection supports, including MySQL, MariaDB, PostgreSQL, SQLite and SQL Server. Native table and column comments are read on MySQL, MariaDB and Postgres; SQLite and SQL Server have none, so they are skipped.',
    source: '/reference/configuration/',
  },
  {
    question: 'Does Laravel Truss work with multiple database connections?',
    answer:
      'Yes. Leave the connections config empty to use the application default, or list the connections you want visualizable. Only listed connections are visualizable, and a request for any other connection returns 404. Per-connection excluded_tables are merged on top of the global list.',
    source: '/reference/configuration/',
  },
  {
    question: 'Does Laravel Truss need a build step or asset publishing?',
    answer:
      'No. There is no separate assets publish step. Truss serves its JavaScript, CSS, fonts and a vendored copy of Mermaid from a route inside the package, so there is nothing to publish and no CDN to reach. Only the config file is publishable, and that is optional.',
    source: '/reference/commands/',
  },
  {
    question: 'Can I try Laravel Truss without installing it?',
    answer:
      'Yes, and on your own schema rather than ours. Paste a mysqldump taken with no data, or the output of truss:export --format=json, and the real dashboard draws your tables in your browser: nothing is uploaded, and no row data is read. There is also a plain demo on a sample schema, a multi-connection variant, and a theme builder. All of it is structure only.',
    source: '/getting-started/quick-start/',
  },
]
