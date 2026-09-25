/**
 * The last stop before the dashboard: validate a parsed schema, make its
 * identifiers safe to render, and account for every difference between what was
 * pasted and what will be drawn.
 *
 * The accounting is the point. Anything this drops (a foreign key with no table
 * to point at, a table with no columns, a name the renderer cannot take) comes
 * back in the report so the page can say it out loud. A schema viewer that
 * quietly draws less than it was given is worse than one that refuses, because
 * the visitor has no way to tell.
 *
 * On identifiers: the shipped dashboard writes table and column names straight
 * into the Mermaid definition without quoting them (mermaid-definition.js). Read
 * from a live database that is safe enough. Pasted, it is not: a brace or a
 * newline in a name corrupts the entire diagram rather than one row of it. So
 * names are reduced to what an unquoted Mermaid identifier allows, consistently
 * across every reference to them, and every substitution is reported.
 */

/** Past this, rendering stops being the bottleneck and the browser does. */
const MAX_TABLES = 500

/** What the diagram can take in an unquoted position. */
const SAFE_IDENTIFIER = /[^A-Za-z0-9_]+/g

/** Characters that could break out of the panel markup a name is shown in. */
const DISPLAY_UNSAFE = /[<>&"'`\r\n\t]+/g

const safeName = (name) => String(name ?? '').replace(SAFE_IDENTIFIER, '_').replace(/^_+|_+$/g, '')

const safeDisplay = (name) => String(name ?? '').replace(DISPLAY_UNSAFE, '').trim()

/**
 * A rename map over a set of names: unchanged where it can be, unique always.
 * Two different names must not collapse into one, or edges between them merge.
 */
function renameMap(names, renamed) {
  const map = new Map()
  const taken = new Set()

  for (const original of names) {
    if (map.has(original)) continue

    let candidate = safeName(original) || 'unnamed'

    if (taken.has(candidate)) {
      let suffix = 2
      while (taken.has(`${candidate}_${suffix}`)) suffix++
      candidate = `${candidate}_${suffix}`
    }

    taken.add(candidate)
    map.set(original, candidate)
    if (candidate !== original) renamed.push({ from: original, to: candidate })
  }

  return map
}

/**
 * @param {{ tables: Array<object>, ignored?: object, unrecognised?: Array<object> }} parsed
 * @param {{ connection?: string, generatedAt?: string }} [options]
 * @returns {{ snapshot: object, report: object }}
 */
export function buildSnapshot(parsed, options = {}) {
  const incoming = parsed?.tables ?? []

  if (incoming.length > MAX_TABLES) {
    throw new Error(
      `That schema has ${incoming.length} tables. This page draws up to ${MAX_TABLES}; run Truss against the database itself for anything larger.`,
    )
  }

  // The parser raises its own (an unrecognised column type, say); this adds the
  // ones only visible once every table is known.
  const problems = [...(parsed?.problems ?? [])]
  const renamed = []
  const kept = []
  const seen = new Set()

  for (const table of incoming) {
    if (seen.has(table.name)) {
      problems.push({
        kind: 'duplicate-table',
        detail: `"${table.name}" is defined more than once. The first one was kept.`,
      })
      continue
    }
    if (!table.columns?.length) {
      problems.push({
        kind: 'empty-table',
        detail: `"${table.name}" has no columns, so there is nothing to draw.`,
      })
      continue
    }

    seen.add(table.name)
    kept.push(table)
  }

  const tableNames = renameMap(kept.map((t) => t.name), renamed)
  const columnNames = new Map(
    kept.map((table) => [table.name, renameMap(table.columns.map((c) => c.name), renamed)]),
  )

  const tables = kept.map((table) => {
    const columns = columnNames.get(table.name)
    const rename = (column) => columns.get(column) ?? safeName(column)
    const has = (column) => columns.has(column)

    const primaryKey = []
    for (const column of table.primary_key ?? []) {
      if (has(column)) primaryKey.push(rename(column))
      else {
        problems.push({
          kind: 'unknown-primary-key-column',
          detail: `The primary key of "${table.name}" names ${column}, which is not one of its columns.`,
        })
      }
    }

    const foreignKeys = []
    for (const key of table.foreign_keys ?? []) {
      if (!tableNames.has(key.references_table)) {
        problems.push({
          kind: 'dangling-foreign-key',
          detail: `${table.name}.${key.name} references ${key.references_table}, which is not in what you pasted.`,
        })
        continue
      }
      if (key.columns.length !== key.references_columns.length || key.columns.length === 0) {
        problems.push({
          kind: 'mismatched-foreign-key',
          detail: `${table.name}.${key.name} has ${key.columns.length} column(s) pointing at ${key.references_columns.length}.`,
        })
        continue
      }

      const targetColumns = columnNames.get(key.references_table)

      foreignKeys.push({
        name: safeDisplay(key.name),
        columns: key.columns.map(rename),
        references_table: tableNames.get(key.references_table),
        references_columns: key.references_columns.map(
          (column) => targetColumns?.get(column) ?? safeName(column),
        ),
        on_update: key.on_update ?? null,
        on_delete: key.on_delete ?? null,
      })
    }

    return {
      name: tableNames.get(table.name),
      columns: table.columns.map((column) => ({
        name: rename(column.name),
        type: column.type,
        nullable: column.nullable !== false,
        default: column.default ?? null,
      })),
      primary_key: primaryKey,
      indexes: (table.indexes ?? []).map((index) => ({
        name: safeDisplay(index.name),
        columns: (index.columns ?? []).map(rename),
        unique: index.unique === true,
      })),
      foreign_keys: foreignKeys,
    }
  })

  const snapshot = {
    connection: options.connection ?? 'pasted',
    fallback: false,
    skipped_migrations: [],
    // No doctor and no diff. Health comes from truss:doctor running against a
    // real database, and the dashboard hides both panels when they are absent.
    generated_at: options.generatedAt ?? new Date().toISOString(),
    tables,
  }

  return {
    snapshot,
    report: {
      counts: {
        tables: tables.length,
        columns: tables.reduce((total, t) => total + t.columns.length, 0),
        indexes: tables.reduce((total, t) => total + t.indexes.length, 0),
        foreignKeys: tables.reduce((total, t) => total + t.foreign_keys.length, 0),
      },
      ignored: parsed?.ignored ?? {},
      unrecognised: parsed?.unrecognised ?? [],
      problems,
      renamed,
    },
  }
}

/**
 * The one line the strip shows, and whether it should be pushed back at.
 *
 * This exists because a corrupted dump once drew a diagram under the same
 * reassuring sentence as a clean one. Everything the report holds is in the
 * Details panel, but almost nobody opens a panel they have no reason to open,
 * so anything genuinely wrong has to reach the sentence itself.
 *
 * Ignored INSERT statements and renamed identifiers deliberately do not count.
 * Skipping row data is the promise working, and a rename is already visible on
 * the diagram; treating either as a warning would train people to ignore the
 * one that matters.
 *
 * @param {object} report from buildSnapshot
 * @returns {{ text: string, attention: string | null }}
 */
export function reportHeadline(report) {
  const { tables, columns, foreignKeys } = report.counts
  const plural = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`

  const parts = []
  if (report.unrecognised.length) {
    parts.push(`${plural(report.unrecognised.length, 'line')} not understood`)
  }
  if (report.problems.length) {
    parts.push(
      report.problems.length === 1
        ? '1 thing needs a look'
        : `${report.problems.length} things need a look`,
    )
  }

  return {
    text: `${plural(tables, 'table')}, ${plural(columns, 'column')}, ${plural(foreignKeys, 'relationship')}.`,
    attention: parts.length ? parts.join(', ') : null,
  }
}
