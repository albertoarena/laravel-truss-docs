import { describe, it, expect } from 'vitest'

import { buildSnapshot, reportHeadline } from '../public/demo/your-schema/import/snapshot.js'

// Everything a parser produces passes through here before it reaches the
// dashboard. Two jobs: make the payload safe to render, and account for every
// difference between what was pasted and what will be drawn.

const parsed = (tables, extra = {}) => ({ tables, ignored: {}, unrecognised: [], ...extra })

const table = (name, over = {}) => ({
  name,
  columns: [{ name: 'id', type: 'int', nullable: false, default: null }],
  primary_key: ['id'],
  indexes: [],
  foreign_keys: [],
  ...over,
})

describe('buildSnapshot: the payload', () => {
  it('wraps the tables in the envelope the dashboard expects', () => {
    const { snapshot } = buildSnapshot(parsed([table('users')]), { generatedAt: '2026-08-20T00:00:00Z' })

    expect(snapshot).toEqual({
      connection: 'pasted',
      fallback: false,
      skipped_migrations: [],
      generated_at: '2026-08-20T00:00:00Z',
      tables: [table('users')],
    })
  })

  it('carries no doctor or diff field', () => {
    // Both are hidden by the dashboard when absent, which is the intended
    // behaviour: health comes from running truss:doctor against a real database,
    // and inventing findings for somebody's schema is not on the table.
    const { snapshot } = buildSnapshot(parsed([table('users')]))

    expect('doctor' in snapshot).toBe(false)
    expect('diff' in snapshot).toBe(false)
  })

  it('counts what it is about to draw', () => {
    const { report } = buildSnapshot(
      parsed([
        table('users', { indexes: [{ name: 'i', columns: ['id'], unique: true }] }),
        table('posts', {
          columns: [
            { name: 'id', type: 'int', nullable: false, default: null },
            { name: 'user_id', type: 'int', nullable: false, default: null },
          ],
          foreign_keys: [
            {
              name: 'f',
              columns: ['user_id'],
              references_table: 'users',
              references_columns: ['id'],
              on_update: null,
              on_delete: null,
            },
          ],
        }),
      ]),
    )

    expect(report.counts).toEqual({ tables: 2, columns: 3, indexes: 1, foreignKeys: 1 })
  })

  it('passes the ignored counts and unrecognised lines straight through', () => {
    const { report } = buildSnapshot(
      parsed([table('t')], {
        ignored: { INSERT: 41 },
        unrecognised: [{ line: 9, snippet: 'WOBBLE' }],
      }),
    )

    expect(report.ignored).toEqual({ INSERT: 41 })
    expect(report.unrecognised).toEqual([{ line: 9, snippet: 'WOBBLE' }])
  })
})

describe('buildSnapshot: validation', () => {
  it('keeps a foreign key pointing at a table that is not in the paste, and draws no edge', () => {
    // A partial dump legitimately does this. Dropping the key silently would
    // hide it; inventing the table would be worse than either.
    const posts = table('posts', {
      foreign_keys: [
        {
          name: 'f',
          columns: ['id'],
          references_table: 'absent',
          references_columns: ['id'],
          on_update: null,
          on_delete: null,
        },
      ],
    })

    const { snapshot, report } = buildSnapshot(parsed([posts]))

    expect(snapshot.tables[0].foreign_keys).toEqual([])
    expect(report.problems).toEqual([
      {
        kind: 'dangling-foreign-key',
        detail: 'posts.f references absent, which is not in what you pasted.',
      },
    ])
  })

  it('drops a foreign key whose column counts do not line up', () => {
    const t = table('t', {
      foreign_keys: [
        {
          name: 'f',
          columns: ['a', 'b'],
          references_table: 't',
          references_columns: ['id'],
          on_update: null,
          on_delete: null,
        },
      ],
    })

    const { snapshot, report } = buildSnapshot(parsed([t]))

    expect(snapshot.tables[0].foreign_keys).toEqual([])
    expect(report.problems[0].kind).toBe('mismatched-foreign-key')
  })

  it('drops a primary key naming a column the table does not have', () => {
    const { snapshot, report } = buildSnapshot(parsed([table('t', { primary_key: ['nope'] })]))

    expect(snapshot.tables[0].primary_key).toEqual([])
    expect(report.problems[0].kind).toBe('unknown-primary-key-column')
  })

  it('keeps the first of two tables sharing a name and reports the collision', () => {
    const { snapshot, report } = buildSnapshot(parsed([table('t'), table('t')]))

    expect(snapshot.tables).toHaveLength(1)
    expect(report.problems[0].kind).toBe('duplicate-table')
  })

  it('drops a table with no columns rather than drawing an empty box', () => {
    const { snapshot, report } = buildSnapshot(parsed([table('t', { columns: [] })]))

    expect(snapshot.tables).toEqual([])
    expect(report.problems[0].kind).toBe('empty-table')
  })
})

describe('buildSnapshot: identifiers', () => {
  // The dashboard writes table and column names straight into the Mermaid
  // definition, unquoted (mermaid-definition.js). With a real database that is
  // safe enough; with pasted text it is not, and a brace or a newline in a name
  // corrupts the whole diagram rather than one row of it.

  it('leaves an ordinary Laravel schema completely alone', () => {
    const { snapshot, report } = buildSnapshot(parsed([table('order_items')]))

    expect(snapshot.tables[0].name).toBe('order_items')
    expect(report.renamed).toEqual([])
  })

  it('rewrites a name the renderer cannot take, and says so', () => {
    const { snapshot, report } = buildSnapshot(parsed([table('my table')]))

    expect(snapshot.tables[0].name).toBe('my_table')
    expect(report.renamed).toEqual([{ from: 'my table', to: 'my_table' }])
  })

  it('rewrites a name carrying diagram syntax', () => {
    const { snapshot } = buildSnapshot(parsed([table('a{b}c')]))

    expect(snapshot.tables[0].name).toBe('a_b_c')
  })

  it('rewrites column names too', () => {
    const { snapshot } = buildSnapshot(
      parsed([table('t', { columns: [{ name: 'first name', type: 'int', nullable: true, default: null }], primary_key: [] })]),
    )

    expect(snapshot.tables[0].columns[0].name).toBe('first_name')
  })

  it('keeps a renamed table reachable from the keys that point at it', () => {
    // A rename that is not applied to the references breaks every edge into the
    // renamed table, which would be a worse bug than the one being fixed.
    const users = table('my users')
    const posts = table('posts', {
      columns: [{ name: 'user id', type: 'int', nullable: false, default: null }],
      primary_key: [],
      indexes: [{ name: 'i', columns: ['user id'], unique: false }],
      foreign_keys: [
        {
          name: 'f',
          columns: ['user id'],
          references_table: 'my users',
          references_columns: ['id'],
          on_update: null,
          on_delete: null,
        },
      ],
    })

    const { snapshot, report } = buildSnapshot(parsed([users, posts]))
    const drawn = snapshot.tables.find((t) => t.name === 'posts')

    expect(drawn.foreign_keys[0].references_table).toBe('my_users')
    expect(drawn.foreign_keys[0].columns).toEqual(['user_id'])
    expect(drawn.indexes[0].columns).toEqual(['user_id'])
    expect(report.problems).toEqual([])
  })

  it('does not collapse two different names into one', () => {
    const { snapshot } = buildSnapshot(parsed([table('a b'), table('a-b')]))

    expect(snapshot.tables.map((t) => t.name)).toEqual(['a_b', 'a_b_2'])
  })

  it('strips markup out of a name that is only ever displayed', () => {
    // Index and key names reach panel markup rather than the diagram, so they
    // keep their shape and lose only what could break out of it.
    const { snapshot } = buildSnapshot(
      parsed([table('t', { indexes: [{ name: '<img src=x>', columns: ['id'], unique: false }] })]),
    )

    expect(snapshot.tables[0].indexes[0].name).not.toMatch(/[<>]/)
  })
})

describe('buildSnapshot: limits', () => {
  it('refuses a schema past the table cap rather than hanging the tab', () => {
    const many = Array.from({ length: 501 }, (_, i) => table(`t${i}`))

    expect(() => buildSnapshot(parsed(many))).toThrow(/500/)
  })

  it('allows a schema right on the cap', () => {
    const many = Array.from({ length: 500 }, (_, i) => table(`t${i}`))

    expect(buildSnapshot(parsed(many)).snapshot.tables).toHaveLength(500)
  })
})

describe('buildSnapshot: problems the parser found', () => {
  it('carries the parser own problems through alongside its own', () => {
    const { report } = buildSnapshot({
      tables: [table('t')],
      ignored: {},
      unrecognised: [],
      problems: [{ kind: 'unknown-column-type', detail: 't.a has the type "dummy".' }],
    })

    expect(report.problems).toEqual([
      { kind: 'unknown-column-type', detail: 't.a has the type "dummy".' },
    ])
  })
})

describe('reportHeadline', () => {
  // The strip is the only thing most people will read. A schema that parsed
  // with something odd in it must not get the same reassuring sentence as one
  // that parsed cleanly: that is what let a corrupted dump look fine.
  const clean = buildSnapshot(parsed([table('users'), table('posts')])).report

  it('states the counts when everything was understood', () => {
    const headline = reportHeadline(clean)

    expect(headline.text).toBe('2 tables, 2 columns, 0 relationships.')
    expect(headline.attention).toBe(null)
  })

  it('flags a statement it could not read', () => {
    const report = { ...clean, unrecognised: [{ line: 9, snippet: 'WOBBLE' }] }

    expect(reportHeadline(report).attention).toBe('1 line not understood')
  })

  it('flags a problem the parser or the validator raised', () => {
    const report = { ...clean, problems: [{ kind: 'unknown-column-type', detail: 'x' }] }

    expect(reportHeadline(report).attention).toBe('1 thing needs a look')
  })

  it('counts both together and pluralises', () => {
    const report = {
      ...clean,
      unrecognised: [{ line: 1, snippet: 'a' }, { line: 2, snippet: 'b' }],
      problems: [{ kind: 'x', detail: 'x' }, { kind: 'y', detail: 'y' }],
    }

    expect(reportHeadline(report).attention).toBe('2 lines not understood, 2 things need a look')
  })

  it('does not treat ignored row data as something needing attention', () => {
    // Skipping INSERT statements is the promise working, not a problem.
    const report = { ...clean, ignored: { INSERT: 41 } }

    expect(reportHeadline(report).attention).toBe(null)
  })

  it('does not treat a rename as something needing attention on its own', () => {
    const report = { ...clean, renamed: [{ from: 'a b', to: 'a_b' }] }

    expect(reportHeadline(report).attention).toBe(null)
  })
})
