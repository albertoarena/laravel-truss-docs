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
        title: 'Schema doctor',
        status: 'shipped',
        version: 'v1.5.0',
        blurb:
          'Run truss:doctor to review your schema for problems visible from structure alone: missing primary keys, unindexed foreign keys, duplicate indexes, money stored as float, and more. It runs in the terminal and in CI, failing the build when a migration introduces a new problem, and a dashboard Health panel flags the same findings on the diagram. Deterministic and structure only, with no AI and no query stats.',
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
        title: 'Schema export for CI and tooling',
        status: 'approved',
        blurb:
          'Generate your schema from the command line with truss:export, so CI can commit an up-to-date schema file and fail the build when it drifts. Structure only, deterministic, and pipeable into your own tools.',
      },
      {
        title: 'Theming and custom palettes',
        status: 'approved',
        blurb:
          'Beyond the light and dark blueprint themes: define your own colours and fonts so the diagram matches the app Truss is embedded in. Config driven, no build step.',
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
        title: 'Schema doctor: more rules and CI formats',
        status: 'exploring',
        blurb:
          'A second pass on truss:doctor: the rest of the rule catalogue, a laravel preset, GitHub and JUnit output for inline CI annotations, a suppression workflow to baseline known findings, and a since-baseline mode that only reports problems a migration newly introduced.',
      },
      {
        title: 'Truss as AI context',
        status: 'exploring',
        blurb:
          'Annotate your schema with meaning, from config or from database comments, and export a compact version tuned for feeding to an AI agent or a text-to-SQL tool. Structure only, no AI inside Truss.',
      },
      {
        title: 'Semantic relationship labels',
        status: 'exploring',
        blurb:
          'Read Eloquent model relationships to label edges (hasMany, belongsToMany) beyond what raw foreign keys reveal.',
      },
      {
        title: 'Large-schema navigation',
        status: 'exploring',
        blurb:
          'Saved views, domain grouping, and a Cmd-K jump so a hundred-table schema stays navigable.',
      },
      {
        title: 'Live DBML playground',
        status: 'exploring',
        tag: 'docs-site',
        blurb:
          'Paste or edit DBML on this site and watch the diagram redraw, so people can try the renderer before installing anything.',
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
        title: 'Filament plugin',
        status: 'wishlist',
        blurb:
          'Surface the diagram inside a Filament admin panel as a first-class page.',
      },
      {
        title: 'MCP server',
        status: 'wishlist',
        blurb:
          'An MCP server so agents like Claude Code and Cursor can pull your live schema directly. Read-only, structure only.',
      },
      {
        title: 'Structural lint hints',
        status: 'wishlist',
        blurb:
          'Gentle, opt-in flags for a missing primary key or an unindexed foreign key, spotted straight from the structure.',
      },
    ],
  },
]
