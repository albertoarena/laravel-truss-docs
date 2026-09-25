/**
 * A Truss JSON export back into the shape the dashboard reads.
 *
 * `php artisan truss:export --format=json` emits a bare array in exactly the
 * SchemaSerializer shape, and the dashboard's own endpoint wraps that array in
 * an envelope. Both get pasted, so both are accepted.
 *
 * There is no parsing here worth the name, and that is the point: this path
 * works for every driver Truss supports on the day it ships, including ones a
 * SQL parser will never cover. It is also what proves the rest of the pipeline
 * before a line of dialect handling exists.
 *
 * Errors are thrown rather than collected. Unlike a dump, where a statement the
 * parser cannot follow is a partial result worth showing, a JSON document is
 * either the shape or it is not.
 */

const asArray = (value) => (Array.isArray(value) ? value : [])

function normaliseColumn(column, tableName, index) {
  if (!column || typeof column !== 'object') {
    throw new Error(`Column ${index + 1} of "${tableName}" is not an object.`)
  }
  if (typeof column.name !== 'string' || !column.name) {
    throw new Error(`Column ${index + 1} of "${tableName}" has no name.`)
  }

  // Rebuilt field by field rather than spread, so anything riding along on the
  // export (the annotations --annotate adds, for one) is left behind instead of
  // being handed to a renderer that has no idea what it is.
  return {
    name: column.name,
    type: typeof column.type === 'string' ? column.type : 'unknown',
    nullable: column.nullable !== false,
    default: column.default ?? null,
  }
}

function normaliseIndex(index) {
  return {
    name: typeof index?.name === 'string' ? index.name : '',
    columns: asArray(index?.columns).filter((c) => typeof c === 'string'),
    unique: index?.unique === true,
  }
}

function normaliseForeignKey(key) {
  return {
    name: typeof key?.name === 'string' ? key.name : '',
    columns: asArray(key?.columns).filter((c) => typeof c === 'string'),
    references_table: typeof key?.references_table === 'string' ? key.references_table : '',
    references_columns: asArray(key?.references_columns).filter((c) => typeof c === 'string'),
    on_update: key?.on_update ?? null,
    on_delete: key?.on_delete ?? null,
  }
}

function normaliseTable(table, index) {
  if (!table || typeof table !== 'object') {
    throw new Error(`Table ${index + 1} is not an object.`)
  }
  if (typeof table.name !== 'string' || !table.name) {
    throw new Error(`Table ${index + 1} has no name.`)
  }

  return {
    name: table.name,
    columns: asArray(table.columns).map((column, i) => normaliseColumn(column, table.name, i)),
    primary_key: asArray(table.primary_key).filter((c) => typeof c === 'string'),
    indexes: asArray(table.indexes).map(normaliseIndex),
    foreign_keys: asArray(table.foreign_keys).map(normaliseForeignKey),
  }
}

/**
 * @param {string} text
 * @returns {{ tables: Array<object>, ignored: Record<string, number>, unrecognised: Array<object> }}
 *   the same result contract the SQL parser returns, so nothing downstream has
 *   to know which format was pasted.
 */
export function parseTrussJson(text) {
  let document

  try {
    document = JSON.parse(String(text ?? ''))
  } catch {
    throw new Error('That is not valid JSON. Paste the output of truss:export --format=json.')
  }

  const tables = Array.isArray(document) ? document : document?.tables

  if (!Array.isArray(tables)) {
    throw new Error(
      'That JSON has no tables in it. Expected an array of tables, or an object with a tables array.',
    )
  }

  return {
    tables: tables.map(normaliseTable),
    ignored: {},
    unrecognised: [],
  }
}
