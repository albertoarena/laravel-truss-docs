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
        title: 'Data dictionary and DBML export',
        status: 'shipped',
        version: 'v1.3.0',
        blurb:
          'Save the current selection as a Markdown data dictionary or a DBML file that opens in dbdiagram.io. Generated in the browser, structure only.',
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
        title: 'Schema diff',
        status: 'shipped',
        version: 'v1.4.0',
        blurb:
          'See what changed since the last migration: added, removed, and changed tables, columns, indexes, and foreign keys, in a dashboard Changes panel and via truss:diff. Structure only.',
      },
    ],
  },
  {
    status: 'approved',
    label: 'Approved next',
    commitment: 'Committed, building next',
    blurb: 'Decided. This is what comes next.',
    // Deliberately empty for now: nothing is committed as the next build. An empty
    // section does not render (see roadmap.astro), so the grid shows three columns
    // rather than a phantom fourth.
    items: [],
  },
  {
    status: 'exploring',
    label: 'Exploring',
    commitment: 'Investigating, may or may not happen',
    blurb: 'On the table, not yet decided.',
    items: [
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
        title: 'Theming and custom palettes',
        status: 'exploring',
        blurb:
          'Beyond the light and dark blueprint themes: bring your own palette so the diagram matches your app or your docs.',
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
        title: 'Structural lint hints',
        status: 'wishlist',
        blurb:
          'Gentle, opt-in flags for a missing primary key or an unindexed foreign key, spotted straight from the structure.',
      },
    ],
  },
]
