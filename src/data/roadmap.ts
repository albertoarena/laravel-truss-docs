/**
 * Public roadmap data. Single source for the /roadmap page: curated status
 * sections rendered left to right as a momentum story, from shipped to wishlist.
 *
 * This is the PUBLIC curation only. Funding mechanics, framework-upgrade
 * decisions, hosting, and the docs refresh itself are deliberately kept out;
 * they live in the private planning notes, not here. Non-binding by design.
 */

export type Status = 'shipped' | 'approved' | 'exploring' | 'wishlist'

export const STATUS_ORDER: Status[] = ['shipped', 'approved', 'exploring', 'wishlist']

export interface RoadmapItem {
  title: string
  status: Status
  blurb: string
  /** Release that shipped the item (shipped section only). */
  version?: string
  /** Small per-card tag, e.g. "community requested" or "docs-site". */
  tag?: string
  /** A related GitHub issue, when one exists. */
  issueUrl?: string
  /**
   * Where to go and use a shipped thing that lives on this site, as a
   * site-relative path. Docs-site items ship with the website rather than a
   * package release, so they carry no version and previously pointed nowhere:
   * the card said "shipped" and left the reader to find it. issueUrl cannot
   * serve here, being constrained to GitHub.
   */
  tryUrl?: string
  /**
   * Label for tryUrl, defaulting to "Try it".
   *
   * The demo and the theme builder are things you try in the browser. A package
   * you install is not, and a card that says "Try it" over a link to its
   * documentation is making a small promise the destination cannot keep.
   */
  linkLabel?: string
}

export interface RoadmapSection {
  status: Status
  label: string
  /** How firm the commitment is, shown under the section heading. */
  commitment: string
  blurb: string
  items: RoadmapItem[]
}

const REPO = 'https://github.com/albertoarena/laravel-truss'

export const SECTIONS: RoadmapSection[] = [
  {
    status: 'shipped',
    label: 'Shipped',
    commitment: 'Released',
    blurb: 'Recent releases. The project moves.',
    items: [
      {
        title: 'Schema diff across MySQL and MariaDB',
        status: 'shipped',
        version: 'v1.15.1',
        blurb:
          'Diffing a MariaDB database against MySQL now shows only the real differences. How each server writes the same column, such as a quoted default, no longer counts as a change.',
      },
      {
        title: 'The standalone binary on Homebrew',
        status: 'shipped',
        version: 'v1.15.0',
        tryUrl: '/binary/installation/',
        linkLabel: 'Read the docs',
        blurb:
          'Install the standalone binary with one line of Homebrew and keep it updated with the rest of your tools. It runs on the PHP you already have.',
      },
      {
        title: 'Truss as a standalone binary',
        status: 'shipped',
        version: 'v1.15.0',
        tryUrl: '/binary/installation/',
        linkLabel: 'Read the docs',
        blurb:
          'Run Truss against any database with a connection string, with no Laravel project needed: one download, on PHP 8.2 or newer. It can also diff two live databases, such as staging against production.',
      },
      {
        title: 'Self-contained HTML export',
        status: 'shipped',
        version: 'v1.14.0',
        blurb:
          'Export the whole diagram as a single HTML file that opens in any browser, with no server and no network. Attach it to a pull request or send it to anyone.',
      },
      {
        title: 'Filament plugin',
        status: 'shipped',
        version: 'v1.0.0',
        tag: 'separate package',
        tryUrl: '/filament/',
        linkLabel: 'Read the docs',
        blurb:
          'A Database schema page inside your Filament panel, in the panel\'s own theme. It ships as albertoarena/filament-truss, so Truss itself gains no Filament dependency.',
      },
      {
        title: 'Laravel Boost support',
        status: 'shipped',
        version: 'v1.10.0',
        tag: 'community requested',
        blurb:
          'Agents set up with Laravel Boost see your real schema instead of guessing columns. Run boost:install and tick Truss: nothing third-party is selected by default.',
      },
      {
        title: 'Searchable Focus picker',
        status: 'shipped',
        version: 'v1.9.0',
        tag: 'community requested',
        blurb:
          'Focus a table by typing any part of its name. Exact names come first, so a schema with hundreds of tables becomes a search instead of a scroll.',
        issueUrl: `${REPO}/issues/39`,
      },
      {
        title: 'Accessibility: keyboard and screen reader support',
        status: 'shipped',
        version: 'v1.9.0',
        blurb:
          'The dashboard works with the keyboard: every control can be reached, with a visible focus ring, and the diagram describes itself to screen readers. Tested by hand and checked with axe-core in CI.',
      },
      {
        title: 'Truss as AI context',
        status: 'shipped',
        version: 'v1.8.0',
        blurb:
          'Give a coding agent your real schema so it stops inventing columns. Add meaning from comments, narrow it to one table and its neighbours, and export a compact format for LLMs.',
      },
      {
        title: 'MCP server',
        status: 'shipped',
        version: 'v1.8.0',
        blurb:
          'An optional MCP server, so agents like Claude Code and Cursor read your live schema when they need it. Read-only and structure only.',
      },
      {
        title: 'Try Truss on your own schema',
        status: 'shipped',
        tag: 'docs-site',
        tryUrl: '/demo/your-schema/',
        blurb:
          'Paste a MySQL or MariaDB schema dump into the demo and see your own tables drawn, with nothing to install. It is parsed in your browser and never uploaded.',
      },
      {
        title: 'Theme builder',
        status: 'shipped',
        tag: 'docs-site',
        tryUrl: '/theme-builder/',
        blurb:
          'Design a Truss theme in the browser against a live preview, then copy the config block. It uses the same settings as the package, so the result matches exactly.',
      },
      {
        title: 'Schema export for CI and tooling',
        status: 'shipped',
        version: 'v1.6.0',
        blurb:
          'Export your schema from the command line with truss:export, so CI can commit it and fail the build when it drifts. Five formats, structure only.',
      },
      {
        title: 'Theming and custom palettes',
        status: 'shipped',
        version: 'v1.6.0',
        blurb:
          'Set your own colours and fonts in config so the dashboard matches your app, in light and dark mode. No build step.',
      },
      {
        title: 'Schema doctor',
        status: 'shipped',
        version: 'v1.5.0',
        blurb:
          'truss:doctor finds problems the structure alone shows, such as a missing primary key or an unindexed foreign key, in the terminal, in CI and on the dashboard. v1.11.0 added a check for foreign keys that point at the wrong table.',
      },
      {
        title: 'Structural lint hints',
        status: 'shipped',
        version: 'v1.5.0',
        blurb:
          'The wishlist idea that became truss:doctor. Problems such as a missing primary key are marked on the diagram itself, one click from the details, and one config switch turns the markers off.',
      },
      {
        title: 'Schema diff',
        status: 'shipped',
        version: 'v1.4.0',
        blurb:
          'See what changed since the last migration: added, removed, and changed tables, columns, indexes, and foreign keys, in a dashboard Changes panel and via truss:diff. Structure only.',
      },
      {
        title: 'Multi-database schema scoping',
        status: 'shipped',
        version: 'v1.3.1',
        blurb:
          'Introspection is scoped to each connection\'s own database, so a shared server never leaks tables from other databases, and a toolbar picker switches between the connections you configure.',
        issueUrl: `${REPO}/issues/3`,
      },
      {
        title: 'Data dictionary and DBML export',
        status: 'shipped',
        version: 'v1.3.0',
        blurb:
          'Save the current selection as a Markdown data dictionary or a DBML file that opens in dbdiagram.io. Generated in the browser, structure only.',
      },
    ],
  },
  {
    status: 'approved',
    label: 'Approved next',
    commitment: 'Committed, building next',
    blurb: 'Decided. This is what comes next.',
    items: [
      {
        title: 'Mermaid diagrams with awkward names',
        status: 'approved',
        tag: 'community requested',
        issueUrl: `${REPO}/issues/94`,
        blurb:
          'A column name Mermaid cannot parse, such as 429_error_date, blanks the whole diagram today. The fix will rewrite only the names Mermaid rejects, and the dashboard will still show the real names.',
      },
      {
        title: 'Schema doctor: more rules',
        status: 'approved',
        blurb:
          'More doctor rules for problems a migration file cannot show you, such as a foreign key the database quietly ignores. Each rule is tested on real applications first, so it does not raise false alarms.',
      },
      {
        title: 'Lighthouse CI',
        status: 'approved',
        tag: 'docs-site',
        blurb:
          'Automated Lighthouse checks in CI for this site and the live demo, in light and dark mode, so a drop in performance or accessibility fails the build.',
      },
    ],
  },
  {
    status: 'exploring',
    label: 'Exploring',
    commitment: 'Investigating, may or may not happen',
    blurb: 'On the table, not yet decided.',
    items: [
      {
        title: 'Accessible structure view',
        status: 'exploring',
        blurb:
          'A toggle that shows the same structure as plain HTML tables instead of a drawing. Easier for screen readers, and also printable, searchable and much better on a phone.',
      },
      {
        title: 'Accessibility conformance review',
        status: 'exploring',
        blurb:
          'Measure what the keyboard work did not cover, such as contrast inside the diagram, fix what fails, then publish an honest statement of what is supported and how to report a problem.',
      },
      {
        title: 'Schema doctor: CI formats',
        status: 'exploring',
        blurb:
          'Show doctor findings as comments on the pull request instead of lines in a log, and report only the problems a new migration adds.',
      },
      {
        title: 'Eloquent relations as a schema source',
        status: 'exploring',
        tag: 'community requested',
        issueUrl: `${REPO}/issues/38`,
        blurb:
          'Read relationships from your Eloquent models, so relations the database does not enforce still appear on the diagram, drawn differently from real foreign keys. Opt in from config.',
      },
      {
        title: 'Large-schema navigation',
        status: 'exploring',
        blurb:
          'Saved views, domain grouping, and a Cmd-K jump so a hundred-table schema stays navigable.',
      },
      {
        title: 'Tenant-aware snapshot caching',
        status: 'exploring',
        tag: 'community requested',
        blurb:
          'Multi-tenant apps that switch databases behind one connection will always see the right schema, not a cached one from another tenant.',
      },
    ],
  },
  {
    status: 'wishlist',
    label: 'Nice to have',
    commitment: 'No timeline',
    blurb: 'Wishlist and community requests. No promises.',
    items: [
      {
        title: 'Persisted manual layout',
        status: 'wishlist',
        tag: 'community requested',
        issueUrl: `${REPO}/issues/2`,
        blurb:
          'Drag tables where you want them and save that arrangement, for a hand-tuned diagram instead of the automatic one.',
      },
      {
        title: 'Embeddable diagram',
        status: 'wishlist',
        blurb:
          'An iframe embed of a focused diagram, to drop a live schema view into a wiki or an internal portal.',
      },
      {
        title: 'Fewer dependencies',
        status: 'wishlist',
        tag: 'community requested',
        issueUrl: `${REPO}/issues/45`,
        blurb:
          'Truss installs one small helper package it could do without. Removing it means one less package in your vendor directory, and one less thing to wait for when Laravel releases a new version.',
      },
    ],
  },
]
