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
          'Run truss:doctor to review your schema for problems visible from structure alone: missing primary keys, unindexed foreign keys, duplicate indexes, money stored as float, and more. It runs in the terminal and in CI, failing the build when a migration introduces a new problem, and a dashboard Health panel flags the same findings on the diagram. Deterministic and structure only, with no AI and no query stats. Recalibrated in v1.10.0 against sixteen real Laravel applications, narrowing TRUSS-INT-007 so an entity table with two foreign keys is no longer called a pivot.',
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
        title: 'Accessible structure view and a conformance statement',
        status: 'approved',
        blurb:
          'The rest of the accessibility work now that the keyboard is done. A text view of the same structure the diagram draws, since a rendered diagram is not a text alternative, then an audit of the criteria v1.9.0 did not cover, including contrast on control boundaries and inside the diagram itself, and a published statement saying exactly what is supported and what is not.',
      },
      {
        title: 'Schema doctor: more rules and CI formats',
        status: 'approved',
        blurb:
          'A second pass on truss:doctor: the rest of the rule catalogue, a laravel preset, GitHub and JUnit output for inline CI annotations, a suppression workflow to baseline known findings, and a since-baseline mode that only reports problems a migration newly introduced.',
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
        title: 'Filament plugin',
        status: 'exploring',
        blurb:
          'Surface the diagram inside a Filament admin panel as a first-class page, so teams already living in Filament get the schema view where they work.',
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
        title: 'Structural lint hints',
        status: 'wishlist',
        blurb:
          'Gentle, opt-in flags for a missing primary key or an unindexed foreign key, spotted straight from the structure.',
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
