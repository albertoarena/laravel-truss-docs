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
        title: 'Laravel Boost support',
        status: 'shipped',
        version: 'v1.10.0',
        tag: 'community requested',
        blurb:
          'Truss ships Boost guidelines and a skill inside the package, so an agent set up with Laravel Boost knows Truss is installed and reaches for your real schema instead of guessing at columns, with no MCP server to wire up by hand. Run boost:install and tick Truss in the third-party list: nothing third-party is selected by default, so it stays your call. The standalone MCP server and truss:export are unchanged, for people not using Boost. Read-only and structure only, as always.',
      },
      {
        title: 'Searchable Focus picker',
        status: 'shipped',
        version: 'v1.9.0',
        tag: 'community requested',
        blurb:
          'Focus a table by typing part of its name. The picker matches anywhere in the name, not just the start, marks what it matched in each row, and ranks exact names first, so a couple of hundred tables is a search rather than a scroll. It agrees with the toolbar filter, which has always matched substrings.',
        issueUrl: `${REPO}/issues/39`,
      },
      {
        title: 'Accessibility: keyboard and screen reader support',
        status: 'shipped',
        version: 'v1.9.0',
        blurb:
          'The dashboard answers the keyboard. Table names, type labels and health markers behave like the buttons they announce themselves as, Escape closes a menu and hands focus back, every trigger has a visible focus ring, and the diagram names and describes the view it is showing for assistive technology. Verified by hand with a screen reader, and guarded by axe-core in CI so it stays that way.',
      },
      {
        title: 'Truss as AI context',
        status: 'shipped',
        version: 'v1.8.0',
        blurb:
          'Turn your schema into grounding context for a coding agent so it stops inventing columns. Annotate it with meaning from config or database comments, trim it with compact mode, narrow it to one table and its foreign-key neighbourhood, and export a token-tuned llm format. Build it in code with the fluent Truss facade or fetch it over a gated route. Structure only, no AI inside Truss.',
      },
      {
        title: 'MCP server',
        status: 'shipped',
        version: 'v1.8.0',
        blurb:
          'An optional Model Context Protocol server so agents like Claude Code and Cursor pull your live schema on demand, with tools to list and describe tables, export the structure in any format, and focus a table. Read-only and structure only.',
      },
      {
        title: 'Try Truss on your own schema',
        status: 'shipped',
        tag: 'docs-site',
        tryUrl: '/demo/your-schema/',
        blurb:
          'Paste a schema dump into the demo on this site, a mysqldump with no data or a schema exported from Truss itself, and see your own tables drawn without installing anything. It is parsed in your browser and never uploaded. MySQL and MariaDB to begin with, and other input formats, including DBML, after that.',
      },
      {
        title: 'Theme builder',
        status: 'shipped',
        tag: 'docs-site',
        tryUrl: '/theme-builder/',
        blurb:
          'Design a Truss theme in the browser: dial in colours and fonts against a live dashboard preview, then copy a ready-to-paste config block. Every value maps to the shipped truss.theme knobs, so what you build is exactly what the package produces.',
      },
      {
        title: 'Schema export for CI and tooling',
        status: 'shipped',
        version: 'v1.6.0',
        blurb:
          'Generate your schema from the command line with truss:export (DBML, JSON, CSV, Markdown, or Mermaid), so CI can commit an up-to-date schema file and fail the build when it drifts. Deterministic, structure only, and pipeable into your own tools.',
      },
      {
        title: 'Theming and custom palettes',
        status: 'shipped',
        version: 'v1.6.0',
        blurb:
          'Define your own colours and fonts from config so the dashboard matches the app Truss is embedded in. A few semantic knobs re-skin the whole diagram, chrome and all, in light and dark. Config driven, CSP safe, no build step.',
      },
      {
        title: 'Schema doctor',
        status: 'shipped',
        version: 'v1.5.0',
        blurb:
          'Run truss:doctor to review your schema for problems visible from structure alone: missing primary keys, unindexed foreign keys, duplicate indexes, money stored as float, and more. It runs in the terminal and in CI, failing the build when a migration introduces a new problem, and a dashboard Health panel flags the same findings on the diagram. Deterministic and structure only, with no AI and no query stats. Recalibrated in v1.10.0 against sixteen real Laravel applications, narrowing TRUSS-INT-007 so an entity table with two foreign keys is no longer called a pivot. v1.11.0 added TRUSS-INT-010, which catches a foreign key that points at the wrong table: found on a real schema where cart line ids were being validated against carts, and silent for years because the database accepted every write.',
      },
      {
        title: 'Structural lint hints',
        status: 'shipped',
        version: 'v1.5.0',
        blurb:
          'The wishlist idea that became truss:doctor. Problems the structure alone can show, a missing primary key or a foreign key with no index behind it, are marked on the diagram itself rather than left for you to notice: a health marker on the table, the finding and its code a click away, and each rule yours to silence or re-grade from config. The markers are on by default, since a finding nobody sees helps nobody, and a single config switch turns them off.',
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
        title: 'Filament plugin',
        status: 'approved',
        blurb:
          'Surface the diagram inside a Filament admin panel as a first-class page, built from the panel\'s own components and styled by its own theme rather than dropped in as a frame around another page. It ships as a separate package, so nothing changes for anybody who does not use Filament, and Truss itself stays free of any Filament dependency.',
      },
      {
        title: 'Self-contained HTML export',
        status: 'approved',
        blurb:
          'Export the whole diagram as a single HTML file that needs nothing to open it: no server, no network, no build step. Commit it next to the migrations, attach it to a pull request, or send it to somebody who has no access to the database, and it opens in any browser exactly as the dashboard drew it. Structure only, as always.',
      },
      {
        title: 'Schema doctor: more rules',
        status: 'approved',
        blurb:
          'A second pass on the rule catalogue, aimed at the problems a migration file cannot show you: a collation that silently stops an index being used across a foreign key, a storage engine that accepts a foreign key and then ignores it, a key pointing at a column nothing keeps unique, the same relationship declared twice, and identifiers stored as plain text. Every new rule is measured against a field study of real applications before it ships, because a rule that cries wolf costs more than the one it catches.',
      },
      {
        title: 'Truss as a standalone binary',
        status: 'approved',
        blurb:
          'Run Truss against any database with a connection string, with no framework and no project to install it into: one download, or one line with Homebrew. The diagram, the doctor and the exports, on a plain PHP codebase, in CI, or against a database somebody just handed you. It is a second way in to the same tool, and it changes nothing for anybody installing Truss the usual way.',
      },
      {
        title: 'Lighthouse CI',
        status: 'approved',
        tag: 'docs-site',
        blurb:
          'Automated Lighthouse audits in CI for this site and the live demo, in both light and dark mode, so performance, accessibility, and best-practices scores stay high and a regression fails the build.',
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
          'A toggle that swaps the canvas for the same structure written as ordinary HTML tables, honouring the filter, focus and depth you already set. It is the text alternative a drawn diagram cannot be, and it earns its place beyond that: printable, searchable with the browser\'s own find, copy-pasteable into a ticket or a wiki, and far better on a phone than pan and zoom.',
      },
      {
        title: 'Accessibility conformance review',
        status: 'exploring',
        blurb:
          'Measure the criteria the keyboard work did not cover, including contrast on control boundaries and inside the diagram itself, fix what fails, and then publish a statement saying exactly what is supported, what is not, how a custom palette changes the answer, and how to report a barrier. Measured first, written second: the statement is worth having only if it is true.',
      },
      {
        title: 'Schema doctor: CI formats',
        status: 'exploring',
        blurb:
          'Make the doctor a better citizen of a pull request: GitHub and JUnit output so findings land as inline annotations rather than buried log lines, a preset tuned to Laravel conventions, a suppression workflow to baseline what you already know about, and a mode that reports only what a migration newly introduced.',
      },
      {
        title: 'Eloquent relations as a schema source',
        status: 'exploring',
        tag: 'community requested',
        issueUrl: `${REPO}/issues/38`,
        blurb:
          'Read Eloquent model relationships as a second source of edges, so relations your app declares but the database never enforces still appear on the diagram, including polymorphic ones a foreign key cannot express. Inferred edges would be drawn distinctly from enforced ones, and the relation kind (hasMany, belongsToMany) would label what the database does enforce. Opt in from config, read from model definitions, structure only.',
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
          'Key the cached schema by the resolved database, not just the connection name, so multi-tenant apps that swap databases behind one connection always show the right schema.',
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
          'Truss installs one small helper package alongside itself, for a handful of one-line conveniences it could do without. Standing on its own would mean one less thing in your vendor directory, and one less package sitting between a new Laravel release and Truss running on it.',
      },
    ],
  },
]
