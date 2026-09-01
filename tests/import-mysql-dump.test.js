import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { parseMysql } from '../public/demo/your-schema/import/mysql.js'

// A whole mysqldump --no-data file, not a hand-cut statement. The unit tests
// above each isolate one rule; this one checks that the rules still hold when a
// real dump surrounds them with version-gated comments, DROP TABLE guards, table
// options, collations on every string column, and a LOCK/INSERT/UNLOCK block.
//
// The expected values are written from what MySQL 8 reports through
// information_schema, NOT from what the parser happens to produce. Where the two
// disagree the parser is wrong. Once the differential CI lane exists this
// expectation becomes machine-generated from a real server rather than authored.

const sql = readFileSync(new URL('./fixtures/dumps/mysql-8-laravel-shop.sql', import.meta.url), 'utf8')
const out = parseMysql(sql)
const table = (name) => out.tables.find((t) => t.name === name)

describe('a real mysqldump --no-data file', () => {
  it('finds every table and nothing that is not one', () => {
    expect(out.tables.map((t) => t.name)).toEqual(['users', 'orders', 'order_line'])
  })

  it('understands every statement in the file', () => {
    expect(out.unrecognised).toEqual([])
  })

  it('reads row data as nothing at all, and says how much it skipped', () => {
    expect(out.ignored.INSERT).toBe(1)
    expect(table('users').columns.every((c) => 'name' in c && 'type' in c)).toBe(true)
  })

  it('counts the scaffolding a dump wraps its schema in', () => {
    expect(out.ignored).toEqual({
      SET: 6,
      DROP: 3,
      LOCK: 1,
      UNLOCK: 1,
      INSERT: 1,
      ALTER: 2,
    })
  })

  it('reports the users table exactly as the server would', () => {
    expect(table('users')).toEqual({
      name: 'users',
      columns: [
        { name: 'id', type: 'bigint unsigned', nullable: false, default: null },
        { name: 'name', type: 'varchar(255)', nullable: false, default: null },
        { name: 'email', type: 'varchar(255)', nullable: false, default: null },
        { name: 'email_verified_at', type: 'timestamp', nullable: true, default: null },
        { name: 'password', type: 'varchar(255)', nullable: false, default: null },
        { name: 'remember_token', type: 'varchar(100)', nullable: true, default: null },
        { name: 'created_at', type: 'timestamp', nullable: true, default: null },
        { name: 'updated_at', type: 'timestamp', nullable: true, default: null },
      ],
      primary_key: ['id'],
      indexes: [{ name: 'users_email_unique', columns: ['email'], unique: true }],
      foreign_keys: [],
    })
  })

  it('keeps the enum, the decimal and the timestamp defaults intact', () => {
    const columns = Object.fromEntries(table('orders').columns.map((c) => [c.name, c]))

    expect(columns.status.type).toBe("enum('pending','paid','shipped','cancelled')")
    expect(columns.status.default).toBe('pending')
    expect(columns.total.type).toBe('decimal(10,2)')
    expect(columns.total.default).toBe('0.00')
    expect(columns.placed_at.default).toBe('CURRENT_TIMESTAMP')
    expect(columns.placed_at.nullable).toBe(false)
    expect(columns.notes.nullable).toBe(true)
  })

  it('leaves the primary key out of the index list and keeps the rest in order', () => {
    expect(table('orders').indexes).toEqual([
      { name: 'orders_reference_unique', columns: ['reference'], unique: true },
      { name: 'orders_user_id_foreign', columns: ['user_id'], unique: false },
      { name: 'orders_status_placed_at_index', columns: ['status', 'placed_at'], unique: false },
    ])
    expect(table('orders').primary_key).toEqual(['id'])
  })

  it('reads the foreign keys with the actions actually declared', () => {
    expect(table('orders').foreign_keys).toEqual([
      {
        name: 'orders_user_id_foreign',
        columns: ['user_id'],
        references_table: 'users',
        references_columns: ['id'],
        on_update: null,
        on_delete: 'cascade',
      },
    ])

    expect(table('order_line').foreign_keys[0].on_delete).toBe('cascade')
    expect(table('order_line').foreign_keys[0].on_update).toBe('restrict')
  })

  it('reads the composite primary key on the pivot', () => {
    expect(table('order_line').primary_key).toEqual(['order_id', 'sku'])
    expect(table('order_line').columns.find((c) => c.name === 'quantity').default).toBe('1')
  })
})
