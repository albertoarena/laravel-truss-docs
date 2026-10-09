/**
 * MySQL and MariaDB DDL to the Truss snapshot shape.
 *
 * The target is SchemaSerializer::table() from the package: name, columns
 * (name / type / nullable / default), primary_key, indexes, foreign_keys, with
 * the primary key hoisted out of the index list the way SnapshotBuilder hoists
 * it. Getting that shape right matters more than parsing cleverness, because it
 * is what the shipped dashboard renders without knowing where it came from.
 *
 * Two rules govern everything here.
 *
 * It never invents a relationship. A column called user_id with no constraint on
 * it is a column, not an edge. Reading intent out of a name is a separate
 * feature of the package, opt-in and clearly marked, and guessing at it here
 * would put a lie about somebody's schema on the page that sells the product.
 *
 * It never drops anything silently. Every statement is either understood,
 * deliberately ignored and counted, or reported by line. A parser that quietly
 * skips what it does not follow produces a diagram that looks complete and is
 * not, which is the worst outcome available.
 *
 * One deliberate divergence from the server: InnoDB ignores a column-level
 * REFERENCES clause, and this honours it. mysqldump never emits that form, so it
 * cannot cost fidelity on the input this is built for, and in hand-written DDL
 * the intent is unambiguous enough that dropping it would be the worse failure.
 */

import { splitStatements, splitTopLevel, matchingParen } from './tokenize.js'

/** Statement kinds a dump is padded with. Counted, never parsed. */
const IGNORED_LEADERS = new Set([
  'INSERT', 'REPLACE', 'DELETE', 'UPDATE', 'TRUNCATE', 'SELECT',
  'SET', 'LOCK', 'UNLOCK', 'DROP', 'USE', 'START', 'COMMIT', 'ROLLBACK', 'BEGIN',
  'GRANT', 'REVOKE', 'FLUSH', 'ANALYZE', 'OPTIMIZE', 'CALL', 'DELIMITER', 'PREPARE',
])

/** CREATE forms that are not a table or an index. */
const IGNORED_CREATE = new Set([
  'DATABASE', 'SCHEMA', 'VIEW', 'TRIGGER', 'PROCEDURE', 'FUNCTION', 'EVENT', 'USER', 'ROLE',
])

/** Type names spelled with two words. */
const TYPE_CONTINUATIONS = {
  double: ['precision'],
  character: ['varying'],
  national: ['char', 'varchar', 'character'],
  long: ['varbinary', 'varchar'],
  bit: ['varying'],
}

/** Modifiers the server reports as part of the type. Character set and collation are not. */
const TYPE_SUFFIXES = new Set(['unsigned', 'zerofill', 'signed'])

/**
 * Every column type MySQL and MariaDB accept.
 *
 * This exists because the parser used to take whatever word sat after the
 * column name and call it the type. Given `workspace_id dummy bigint unsigned`
 * it produced a column of type "dummy" and reported nothing at all, so a
 * corrupted dump drew a diagram that looked fine. Anything not on this list is
 * still drawn, since the column carries keys elsewhere and dropping it would
 * cascade, but it is now reported.
 */
const KNOWN_TYPES = new Set([
  // numeric
  'bit', 'tinyint', 'smallint', 'mediumint', 'int', 'integer', 'bigint',
  'decimal', 'dec', 'numeric', 'fixed', 'float', 'double', 'double precision',
  'real', 'bool', 'boolean', 'serial',
  // date and time
  'date', 'datetime', 'timestamp', 'time', 'year',
  // string and binary
  'char', 'varchar', 'binary', 'varbinary', 'tinyblob', 'blob', 'mediumblob',
  'longblob', 'tinytext', 'text', 'mediumtext', 'longtext', 'enum', 'set',
  'character', 'character varying', 'nchar', 'nvarchar', 'national char',
  'national varchar', 'national character', 'long varchar', 'long varbinary',
  'bit varying',
  // json and spatial
  'json', 'geometry', 'point', 'linestring', 'polygon', 'multipoint',
  'multilinestring', 'multipolygon', 'geometrycollection', 'geomcollection',
  // MariaDB
  'inet4', 'inet6', 'uuid',
])

/** The type without its arguments or its unsigned/zerofill tail. */
const baseTypeName = (type) => String(type).split('(')[0].replace(/\s+(unsigned|zerofill|signed)$/g, '').trim()

const REFERENTIAL_ACTIONS = ['set null', 'set default', 'no action', 'cascade', 'restrict']

/* ---- small readers ----------------------------------------------------- */

const isSpace = (ch) => ch !== undefined && /\s/.test(ch)

function skipSpace(text, i) {
  while (i < text.length && isSpace(text[i])) i++
  return i
}

/** The word at `i`, or null. Does not consume. */
function wordAt(text, i) {
  const match = /^[A-Za-z_][A-Za-z0-9_$]*/.exec(text.slice(i))
  return match ? match[0] : null
}

/**
 * An identifier at `i`, quoted or bare, possibly qualified.
 *
 * Only the last part is kept: `app`.`users` is the table users, and the database
 * a dump was taken from is not part of the schema being drawn.
 */
function readIdentifier(text, start) {
  let i = skipSpace(text, start)
  const parts = []

  for (;;) {
    const ch = text[i]

    if (ch === '`' || ch === '"') {
      let j = i + 1
      let name = ''
      while (j < text.length) {
        if (text[j] === ch) {
          if (text[j + 1] === ch) {
            name += ch
            j += 2
            continue
          }
          break
        }
        name += text[j]
        j++
      }
      parts.push(name)
      i = j + 1
    } else {
      const word = /^[A-Za-z0-9_$-￿]+/.exec(text.slice(i))
      if (!word) break
      parts.push(word[0])
      i += word[0].length
    }

    if (text[i] === '.') {
      i++
      continue
    }
    break
  }

  return { name: parts.length ? parts[parts.length - 1] : '', end: i }
}

/** Strip the quotes from a literal and undo both escape conventions. */
function unquote(literal) {
  const quote = literal[0]
  if (quote !== "'" && quote !== '"') return literal

  return literal
    .slice(1, -1)
    .replace(new RegExp(`\\\\${quote}`, 'g'), quote)
    .replace(new RegExp(`${quote}${quote}`, 'g'), quote)
}

/** A quoted run starting at `i`, or null. */
function readQuoted(text, i) {
  const quote = text[i]
  if (quote !== "'" && quote !== '"') return null

  let j = i + 1
  while (j < text.length) {
    if (text[j] === '\\') {
      j += 2
      continue
    }
    if (text[j] === quote) {
      if (text[j + 1] === quote) {
        j += 2
        continue
      }
      return { text: text.slice(i, j + 1), end: j + 1 }
    }
    j++
  }

  return { text: text.slice(i), end: text.length }
}

/** Whitespace outside quotes squeezed out, so decimal(10, 2) reads as decimal(10,2). */
function normaliseArgs(args) {
  let out = ''
  let i = 0

  while (i < args.length) {
    const quoted = readQuoted(args, i)
    if (quoted) {
      out += quoted.text
      i = quoted.end
      continue
    }
    if (!isSpace(args[i])) out += args[i]
    i++
  }

  return out
}

/**
 * The column names in a key definition.
 *
 * Prefix lengths and sort directions are part of how the index is built, not of
 * which columns it covers, and the dashboard shows the columns.
 */
function parseKeyColumns(list) {
  return splitTopLevel(list).map((entry) => {
    const { name } = readIdentifier(entry, 0)
    return name
  }).filter(Boolean)
}

/** The parenthesised group at or after `i`, with its contents. */
function readGroup(text, start) {
  const i = skipSpace(text, start)
  if (text[i] !== '(') return null

  const close = matchingParen(text, i)
  if (close === -1) return null

  return { body: text.slice(i + 1, close), end: close + 1 }
}

/* ---- column definitions ------------------------------------------------ */

function parseType(rest) {
  let i = skipSpace(rest, 0)

  const base = wordAt(rest, i)
  if (!base) return null
  i += base.length
  let type = base.toLowerCase()

  const continuations = TYPE_CONTINUATIONS[type]
  if (continuations) {
    const mark = i
    const at = skipSpace(rest, i)
    const next = wordAt(rest, at)
    if (next && continuations.includes(next.toLowerCase())) {
      type += ` ${next.toLowerCase()}`
      i = at + next.length
    } else {
      i = mark
    }
  }

  const group = readGroup(rest, i)
  if (group) {
    type += `(${normaliseArgs(group.body)})`
    i = group.end
  }

  for (;;) {
    const at = skipSpace(rest, i)
    const next = wordAt(rest, at)
    if (next && TYPE_SUFFIXES.has(next.toLowerCase())) {
      type += ` ${next.toLowerCase()}`
      i = at + next.length
      continue
    }
    break
  }

  return { type, end: i }
}

/** The value after DEFAULT, as the server would report it. */
function readDefault(text, start) {
  const i = skipSpace(text, start)

  const quoted = readQuoted(text, i)
  if (quoted) return { value: unquote(quoted.text), end: quoted.end }

  const group = readGroup(text, i)
  if (group) return { value: `(${group.body.trim()})`, end: group.end }

  const token = /^[A-Za-z0-9_$.+-]+/.exec(text.slice(i))
  if (!token) return { value: null, end: i }

  let end = i + token[0].length
  let value = token[0]

  // b'1' and x'ff' are one literal, and CURRENT_TIMESTAMP(3) carries a precision.
  const attached = readQuoted(text, end) || readGroup(text, end)
  if (attached && skipSpace(text, end) === end) {
    value += attached.text ?? `(${attached.body})`
    end = attached.end
  }

  return { value: /^null$/i.test(value) ? null : value, end }
}

function parseReferences(text, start) {
  const target = readIdentifier(text, start)
  if (!target.name) return null

  const group = readGroup(text, target.end)
  if (!group) return null

  const reference = {
    table: target.name,
    columns: parseKeyColumns(group.body),
    onDelete: null,
    onUpdate: null,
  }

  let i = group.end
  for (;;) {
    const at = skipSpace(text, i)
    if (!/^on\b/i.test(text.slice(at))) break

    const rest = text.slice(at + 2)
    const which = /^\s*(delete|update)\s*/i.exec(rest)
    if (!which) break

    const after = rest.slice(which[0].length)
    const action = REFERENTIAL_ACTIONS.find((candidate) =>
      after.toLowerCase().startsWith(candidate),
    )
    if (!action) break

    if (which[1].toLowerCase() === 'delete') reference.onDelete = action
    else reference.onUpdate = action

    i = at + 2 + which[0].length + action.length
  }

  return { reference, end: i }
}

/**
 * One entry from a CREATE TABLE body that is a column rather than a key.
 *
 * The flags are read by walking tokens rather than by matching patterns against
 * the whole definition, because a COMMENT 'NOT NULL' would otherwise make a
 * nullable column not nullable.
 */
function parseColumnDefinition(entry) {
  const { name, end } = readIdentifier(entry, 0)
  if (!name) return null

  const parsed = parseType(entry.slice(end))
  if (!parsed) return null

  const column = { name, type: parsed.type, nullable: true, default: null }
  const extra = { primary: false, unique: false, reference: null }

  const tail = entry.slice(end + parsed.end)
  let i = 0

  while (i < tail.length) {
    i = skipSpace(tail, i)
    if (i >= tail.length) break

    const quoted = readQuoted(tail, i)
    if (quoted) {
      i = quoted.end
      continue
    }

    const word = wordAt(tail, i)
    if (!word) {
      i++
      continue
    }

    const keyword = word.toLowerCase()
    i += word.length

    if (keyword === 'not') {
      const at = skipSpace(tail, i)
      if (/^null\b/i.test(tail.slice(at))) {
        column.nullable = false
        i = at + 4
      }
      continue
    }

    if (keyword === 'null') {
      column.nullable = true
      continue
    }

    if (keyword === 'default') {
      const value = readDefault(tail, i)
      column.default = value.value
      i = value.end
      continue
    }

    if (keyword === 'primary') {
      const at = skipSpace(tail, i)
      if (/^key\b/i.test(tail.slice(at))) {
        extra.primary = true
        i = at + 3
      }
      continue
    }

    if (keyword === 'unique') {
      extra.unique = true
      const at = skipSpace(tail, i)
      if (/^key\b/i.test(tail.slice(at))) i = at + 3
      continue
    }

    if (keyword === 'references') {
      const parsedReference = parseReferences(tail, i)
      if (parsedReference) {
        extra.reference = parsedReference.reference
        i = parsedReference.end
      }
      continue
    }

    // Clauses whose value must be stepped over so it is not read as a flag.
    if (keyword === 'comment' || keyword === 'collate' || keyword === 'charset') {
      const at = skipSpace(tail, i)
      const value = readQuoted(tail, at)
      i = value ? value.end : at + (wordAt(tail, at)?.length ?? 0)
      continue
    }

    if (keyword === 'character') {
      const at = skipSpace(tail, i)
      if (/^set\b/i.test(tail.slice(at))) {
        const after = skipSpace(tail, at + 3)
        i = after + (wordAt(tail, after)?.length ?? 0)
      }
      continue
    }

    if (keyword === 'on') {
      // Column level ON UPDATE CURRENT_TIMESTAMP, not a referential action.
      const at = skipSpace(tail, i)
      const which = wordAt(tail, at)
      if (which) {
        const after = skipSpace(tail, at + which.length)
        const value = readDefault(tail, after)
        i = value.end
      }
      continue
    }

    if (keyword === 'as' || keyword === 'check') {
      const group = readGroup(tail, i)
      if (group) i = group.end
      continue
    }
  }

  return { column, extra }
}

/* ---- key definitions --------------------------------------------------- */

/**
 * One entry from a CREATE TABLE body, or one clause of an ALTER TABLE, that
 * defines a key. Returns null when the entry is not a key at all, which is how
 * the caller tells a column apart from a constraint.
 */
function parseKeyDefinition(entry) {
  let text = entry.trim()
  let name = null

  const named = /^constraint\b/i.exec(text)
  if (named) {
    const rest = text.slice(named[0].length)
    const at = skipSpace(rest, 0)
    // CONSTRAINT may be followed by a name, or straight by the key kind.
    if (!/^(primary|unique|foreign|check)\b/i.test(rest.slice(at))) {
      const identifier = readIdentifier(rest, at)
      name = identifier.name || null
      text = rest.slice(identifier.end).trim()
    } else {
      text = rest.slice(at)
    }
  }

  if (/^check\b/i.test(text)) return { kind: 'check' }

  if (/^primary\s+key\b/i.test(text)) {
    const group = readGroup(text, /^primary\s+key/i.exec(text)[0].length)
    if (!group) return null
    return { kind: 'primary', columns: parseKeyColumns(group.body) }
  }

  const foreign = /^foreign\s+key\b/i.exec(text)
  if (foreign) {
    let i = foreign[0].length
    // An optional index name sits between FOREIGN KEY and the column list.
    if (skipSpace(text, i) < text.length && text[skipSpace(text, i)] !== '(') {
      i = readIdentifier(text, i).end
    }
    const group = readGroup(text, i)
    if (!group) return null

    const after = text.slice(group.end)
    const references = /^\s*references\b/i.exec(after)
    if (!references) return null

    const parsed = parseReferences(after, references[0].length)
    if (!parsed) return null

    return {
      kind: 'foreign',
      name,
      columns: parseKeyColumns(group.body),
      reference: parsed.reference,
    }
  }

  const index = /^(unique|fulltext|spatial)?\s*(key|index)\b/i.exec(text)
  if (index && (index[1] || index[2])) {
    const unique = (index[1] || '').toLowerCase() === 'unique'
    let i = index[0].length
    if (skipSpace(text, i) < text.length && text[skipSpace(text, i)] !== '(') {
      const identifier = readIdentifier(text, i)
      if (identifier.name) {
        name = name ?? identifier.name
        i = identifier.end
      }
    }
    const group = readGroup(text, i)
    if (!group) return null

    const columns = parseKeyColumns(group.body)
    return { kind: 'index', name: name ?? columns[0] ?? 'index', columns, unique }
  }

  // UNIQUE (cols), with neither KEY nor INDEX spelled out.
  const bareUnique = /^unique\b/i.exec(text)
  if (bareUnique) {
    const group = readGroup(text, bareUnique[0].length)
    if (!group) return null
    const columns = parseKeyColumns(group.body)
    return { kind: 'index', name: name ?? columns[0] ?? 'unique', columns, unique: true }
  }

  return null
}

/* ---- statements -------------------------------------------------------- */

const CREATE_TABLE = /^create\s+(?:temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?/i

function parseCreateTable(statement) {
  const header = CREATE_TABLE.exec(statement)
  if (!header) return null

  const { name, end } = readIdentifier(statement, header[0].length)
  if (!name) return null

  const group = readGroup(statement, end)
  if (!group) return null

  const table = { name, columns: [], primary_key: [], indexes: [], foreign_keys: [] }
  const unparsed = []
  const problems = []
  let anonymousForeignKeys = 0

  for (const entry of splitTopLevel(group.body)) {
    const key = parseKeyDefinition(entry)

    if (key) {
      if (key.kind === 'check') continue
      if (key.kind === 'primary') table.primary_key = key.columns
      if (key.kind === 'index') {
        table.indexes.push({ name: key.name, columns: key.columns, unique: key.unique })
      }
      if (key.kind === 'foreign') {
        anonymousForeignKeys += key.name ? 0 : 1
        table.foreign_keys.push(foreignKey(key, name, anonymousForeignKeys))
      }
      continue
    }

    const column = parseColumnDefinition(entry)
    if (!column) {
      unparsed.push(entry)
      continue
    }

    if (!KNOWN_TYPES.has(baseTypeName(column.column.type))) {
      problems.push({
        kind: 'unknown-column-type',
        detail: `${name}.${column.column.name} has the type "${column.column.type}", which is not a MySQL type. Drawn as written.`,
      })
    }

    table.columns.push(column.column)
    if (column.extra.primary) table.primary_key = [column.column.name]
    if (column.extra.unique) {
      table.indexes.push({
        name: column.column.name,
        columns: [column.column.name],
        unique: true,
      })
    }
    if (column.extra.reference) {
      anonymousForeignKeys++
      table.foreign_keys.push(
        foreignKey(
          { name: null, columns: [column.column.name], reference: column.extra.reference },
          name,
          anonymousForeignKeys,
        ),
      )
    }
  }

  applyPrimaryKeyNullability(table)

  return { table, unparsed, problems }
}

/** The server names an unnamed foreign key <table>_ibfk_<n>, so this does too. */
function foreignKey(key, tableName, ordinal) {
  return {
    name: key.name ?? `${tableName}_ibfk_${ordinal}`,
    columns: key.columns,
    references_table: key.reference.table,
    references_columns: key.reference.columns,
    on_update: key.reference.onUpdate,
    on_delete: key.reference.onDelete,
  }
}

/** A primary key column is NOT NULL whether or not the DDL bothered to say so. */
function applyPrimaryKeyNullability(table) {
  for (const column of table.columns) {
    if (table.primary_key.includes(column.name)) column.nullable = false
  }
}

const CREATE_INDEX = /^create\s+(unique\s+|fulltext\s+|spatial\s+)?index\s+/i

function parseCreateIndex(statement) {
  const header = CREATE_INDEX.exec(statement)
  if (!header) return null

  const index = readIdentifier(statement, header[0].length)
  const rest = statement.slice(index.end)
  const on = /^\s*on\s+/i.exec(rest)
  if (!on) return null

  const target = readIdentifier(rest, on[0].length)
  const group = readGroup(rest, target.end)
  if (!group || !target.name) return null

  return {
    table: target.name,
    key: {
      kind: 'index',
      name: index.name || target.name,
      columns: parseKeyColumns(group.body),
      unique: Boolean(header[1]),
    },
  }
}

const ALTER_TABLE = /^alter\s+(?:online\s+|ignore\s+)?table\s+/i

function parseAlterTable(statement) {
  const header = ALTER_TABLE.exec(statement)
  if (!header) return null

  const target = readIdentifier(statement, header[0].length)
  if (!target.name) return null

  const additions = []
  let ignored = 0

  for (const clause of splitTopLevel(statement.slice(target.end))) {
    const add = /^add\s+/i.exec(clause)
    if (!add) {
      ignored++
      continue
    }

    let rest = clause.slice(add[0].length)
    const column = /^column\s+/i.exec(rest)
    if (column) rest = rest.slice(column[0].length)

    const key = parseKeyDefinition(rest)
    if (key) {
      additions.push({ kind: 'key', key })
      continue
    }

    const parsed = parseColumnDefinition(rest)
    if (parsed) {
      additions.push({ kind: 'column', column: parsed.column, extra: parsed.extra })
      continue
    }

    ignored++
  }

  return { table: target.name, additions, ignored }
}

function applyKey(table, key) {
  if (key.kind === 'check') return
  if (key.kind === 'primary') {
    table.primary_key = key.columns
    applyPrimaryKeyNullability(table)
    return
  }
  if (key.kind === 'index') {
    table.indexes.push({ name: key.name, columns: key.columns, unique: key.unique })
    return
  }
  if (key.kind === 'foreign') {
    const ordinal = table.foreign_keys.length + 1
    table.foreign_keys.push(foreignKey(key, table.name, ordinal))
  }
}

/* ---- the pass ---------------------------------------------------------- */

/**
 * @param {string} sql
 * @returns {{
 *   tables: Array<object>,
 *   ignored: Record<string, number>,
 *   unrecognised: Array<{ line: number, snippet: string }>,
 * }}
 */
export function parseMysql(sql) {
  const tables = []
  const byName = new Map()
  const ignored = {}
  const unrecognised = []
  const problems = []
  const deferred = []

  const count = (kind) => {
    ignored[kind] = (ignored[kind] ?? 0) + 1
  }
  const reject = (statement) => {
    unrecognised.push({
      line: statement.line,
      snippet: statement.text.replace(/\s+/g, ' ').slice(0, 120),
    })
  }

  for (const statement of splitStatements(sql)) {
    const leader = (wordAt(statement.text, 0) ?? '').toUpperCase()

    if (CREATE_TABLE.test(statement.text)) {
      const parsed = parseCreateTable(statement.text)
      if (!parsed) {
        reject(statement)
        continue
      }
      for (const entry of parsed.unparsed) {
        unrecognised.push({ line: statement.line, snippet: entry.replace(/\s+/g, ' ').slice(0, 120) })
      }
      problems.push(...parsed.problems)
      tables.push(parsed.table)
      byName.set(parsed.table.name, parsed.table)
      continue
    }

    if (CREATE_INDEX.test(statement.text) || ALTER_TABLE.test(statement.text)) {
      deferred.push(statement)
      continue
    }

    if (leader === 'CREATE') {
      const second = (wordAt(statement.text, skipSpace(statement.text, 6)) ?? '').toUpperCase()
      if (IGNORED_CREATE.has(second)) {
        count(`CREATE ${second}`)
        continue
      }
      reject(statement)
      continue
    }

    if (IGNORED_LEADERS.has(leader)) {
      count(leader)
      continue
    }

    reject(statement)
  }

  // Constraints added after the tables, applied once every table is known.
  for (const statement of deferred) {
    if (CREATE_INDEX.test(statement.text)) {
      const parsed = parseCreateIndex(statement.text)
      const table = parsed && byName.get(parsed.table)
      if (!table) {
        reject(statement)
        continue
      }
      applyKey(table, parsed.key)
      continue
    }

    const parsed = parseAlterTable(statement.text)
    const table = parsed && byName.get(parsed.table)

    if (!table) {
      if (parsed && parsed.additions.length === 0) count('ALTER')
      else reject(statement)
      continue
    }

    for (const addition of parsed.additions) {
      if (addition.kind === 'key') applyKey(table, addition.key)
      else {
        table.columns.push(addition.column)
        if (addition.extra.primary) {
          table.primary_key = [addition.column.name]
          applyPrimaryKeyNullability(table)
        }
      }
    }

    for (let n = 0; n < parsed.ignored; n++) count('ALTER')
  }

  return { tables, ignored, unrecognised, problems }
}
