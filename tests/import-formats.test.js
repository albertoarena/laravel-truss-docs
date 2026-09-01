import { describe, it, expect } from 'vitest'

import { detectFormat } from '../public/demo/your-schema/import/detect.js'
import { parseTrussJson } from '../public/demo/your-schema/import/truss-json.js'

describe('detectFormat', () => {
  it('recognises a Truss JSON export, which is a bare array of tables', () => {
    expect(detectFormat('[{"name":"users","columns":[]}]')).toBe('truss-json')
  })

  it('recognises a dashboard payload, which wraps the array', () => {
    expect(detectFormat('{"tables":[{"name":"users","columns":[]}]}')).toBe('truss-json')
  })

  it('recognises SQL by its CREATE TABLE, whatever the case', () => {
    expect(detectFormat('create table `users` (`id` int);')).toBe('mysql')
    expect(detectFormat('-- a dump\n\nCREATE TABLE users (id int);')).toBe('mysql')
  })

  it('recognises SQL that only alters, since a partial paste is still SQL', () => {
    expect(detectFormat('ALTER TABLE `a` ADD PRIMARY KEY (`id`);')).toBe('mysql')
  })

  it('returns null for something it cannot place', () => {
    expect(detectFormat('hello')).toBe(null)
    expect(detectFormat('')).toBe(null)
    expect(detectFormat('   ')).toBe(null)
  })

  it('does not call malformed JSON a schema', () => {
    expect(detectFormat('{"tables": [')).toBe(null)
  })

  it('does not call a JSON document that is not a schema one', () => {
    expect(detectFormat('{"name":"my-app","version":"1.0.0"}')).toBe(null)
  })
})

describe('parseTrussJson', () => {
  // truss:export --format=json emits a bare array in exactly the
  // SchemaSerializer shape. The dashboard's own endpoint wraps it. Both are
  // things somebody will paste, so both are accepted.
  const one = [
    {
      name: 'users',
      columns: [{ name: 'id', type: 'bigint unsigned', nullable: false, default: null }],
      primary_key: ['id'],
      indexes: [],
      foreign_keys: [],
    },
  ]

  it('accepts a bare array of tables', () => {
    expect(parseTrussJson(JSON.stringify(one)).tables).toEqual(one)
  })

  it('accepts the wrapped dashboard payload', () => {
    expect(parseTrussJson(JSON.stringify({ tables: one })).tables).toEqual(one)
  })

  it('reports the same empty ignored and unrecognised shape the SQL parser does', () => {
    // The caller must not care which format it fed in.
    const out = parseTrussJson(JSON.stringify(one))

    expect(out.ignored).toEqual({})
    expect(out.unrecognised).toEqual([])
  })

  it('fills in the parts of a table that an export left out', () => {
    const out = parseTrussJson('[{"name":"t","columns":[{"name":"a","type":"int"}]}]')

    expect(out.tables[0]).toEqual({
      name: 't',
      columns: [{ name: 'a', type: 'int', nullable: true, default: null }],
      primary_key: [],
      indexes: [],
      foreign_keys: [],
    })
  })

  it('drops annotations that the AI-context export adds', () => {
    // truss:export --annotate rides annotations along on the same shape. They
    // are not structure and the dashboard does not read them.
    const out = parseTrussJson(
      '[{"name":"t","annotation":"the thing","columns":[{"name":"a","type":"int","annotation":"an id"}]}]',
    )

    expect(out.tables[0].annotation).toBeUndefined()
    expect(out.tables[0].columns[0].annotation).toBeUndefined()
  })

  it('throws something sayable on malformed JSON', () => {
    expect(() => parseTrussJson('{oh no')).toThrow(/valid JSON/i)
  })

  it('throws when the JSON is valid but is not a schema', () => {
    expect(() => parseTrussJson('{"name":"my-app"}')).toThrow(/tables/i)
  })

  it('throws when a table has no name', () => {
    expect(() => parseTrussJson('[{"columns":[]}]')).toThrow(/name/i)
  })

  it('reports an empty export as no tables rather than as an error', () => {
    expect(parseTrussJson('[]').tables).toEqual([])
  })
})
