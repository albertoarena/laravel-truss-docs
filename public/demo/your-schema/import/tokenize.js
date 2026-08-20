/**
 * A small, linear scanner for SQL text.
 *
 * Everything above this file assumes it can trust where one statement ends and
 * the next begins, and where a comma is a separator rather than part of a type.
 * A regex cannot answer either question: a semicolon inside a string literal, a
 * comma inside enum('a,b'), and a version-gated comment that actually contains
 * SQL all look the same to one. So this walks the text once, character by
 * character, and it is the only place in the importer that knows about quoting,
 * comments and nesting.
 *
 * Linear by construction, with no backtracking, so a two megabyte paste cannot
 * hang the tab. Plain ES module, no dependencies: it is loaded straight from
 * public/ by the browser and imported directly by Vitest.
 */

/** Quote characters that open a literal or a quoted identifier. */
const QUOTES = new Set(["'", '"', '`'])

/**
 * Index just past the closing quote of the run opened at `i`.
 *
 * Handles both escape conventions MySQL accepts inside string literals: a
 * doubled quote ('it''s') and a backslash ('it\'s'). Backslash is not an escape
 * inside a backquoted identifier, where doubling is the only form. An
 * unterminated run consumes to the end rather than throwing, so a truncated
 * paste still produces a diagnosable result.
 */
function skipQuoted(text, i) {
  const quote = text[i]
  const backslashEscapes = quote !== '`'
  let j = i + 1

  while (j < text.length) {
    const ch = text[j]

    if (backslashEscapes && ch === '\\') {
      j += 2
      continue
    }
    if (ch === quote) {
      if (text[j + 1] === quote) {
        j += 2
        continue
      }
      return j + 1
    }
    j++
  }

  return j
}

/**
 * A comment starting at `i`, or null when there is none.
 *
 * Returns the index just past it and the text it should be replaced by. That
 * text is a single space for an ordinary comment, because a comment separates
 * tokens, and the SQL itself for a MySQL executable comment.
 *
 * Executable comments are the reason this cannot be a strip-and-forget step.
 * mysqldump wraps version-gated statements as `/*!40101 SET NAMES utf8mb4 * /`,
 * and the body is real SQL that a stripper would discard along with the marker.
 */
function commentAt(text, i) {
  // Two dashes start a comment only when followed by whitespace, which is
  // MySQL's actual rule and keeps expressions like `a--b` intact.
  if (text[i] === '-' && text[i + 1] === '-' && (i + 2 >= text.length || /\s/.test(text[i + 2]))) {
    const end = text.indexOf('\n', i)
    return { end: end === -1 ? text.length : end, replacement: ' ' }
  }

  if (text[i] === '#') {
    const end = text.indexOf('\n', i)
    return { end: end === -1 ? text.length : end, replacement: ' ' }
  }

  if (text[i] === '/' && text[i + 1] === '*') {
    const close = text.indexOf('*/', i + 2)
    const end = close === -1 ? text.length : close + 2
    const body = text.slice(i + 2, close === -1 ? text.length : close)

    if (body.startsWith('!')) {
      // `!` then an optional five digit version, then the statement.
      return { end, replacement: ` ${body.replace(/^!\d*/, '')} ` }
    }

    return { end, replacement: ' ' }
  }

  return null
}

/**
 * Split a script into statements.
 *
 * @param {string} sql
 * @returns {Array<{ text: string, line: number }>} one entry per non-empty
 *   statement, with its terminator removed and the 1-based line it starts on,
 *   so anything the parser cannot make sense of can be reported by position.
 */
export function splitStatements(sql) {
  const src = String(sql ?? '')
  const out = []

  let buffer = ''
  let line = 1
  let startLine = null
  let delimiter = ';'
  let i = 0

  const consume = (to) => {
    for (let k = i; k < to; k++) if (src[k] === '\n') line++
    i = to
  }

  const append = (text, atLine) => {
    if (startLine === null && text.trim()) startLine = atLine
    buffer += text
  }

  const flush = () => {
    const text = buffer.trim()
    if (text) out.push({ text, line: startLine ?? line })
    buffer = ''
    startLine = null
  }

  while (i < src.length) {
    const ch = src[i]

    // A client-side DELIMITER command, recognised only at a statement boundary.
    // Without it, a trigger body full of semicolons splits into nonsense.
    if (!buffer.trim() && (ch === 'd' || ch === 'D')) {
      const match = /^delimiter[ \t]+(\S+)[ \t]*/i.exec(src.slice(i))
      if (match) {
        delimiter = match[1]
        buffer = ''
        startLine = null
        consume(i + match[0].length)
        continue
      }
    }

    const comment = commentAt(src, i)
    if (comment) {
      const at = line
      consume(comment.end)
      append(comment.replacement, at)
      continue
    }

    if (QUOTES.has(ch)) {
      const at = line
      const end = skipQuoted(src, i)
      const text = src.slice(i, end)
      consume(end)
      append(text, at)
      continue
    }

    if (src.startsWith(delimiter, i)) {
      consume(i + delimiter.length)
      flush()
      continue
    }

    append(ch, line)
    consume(i + 1)
  }

  flush()

  return out
}

/**
 * Split a list at its top-level separators.
 *
 * Used for the body of a CREATE TABLE, whose entries are separated by commas
 * that also appear inside decimal(10,2), inside enum('a','b'), and inside the
 * column list of a compound key. Depth and quoting decide, not the character.
 *
 * @param {string} text
 * @param {string} [separator]
 * @returns {string[]} trimmed, with empty segments dropped
 */
export function splitTopLevel(text, separator = ',') {
  const src = String(text ?? '')
  const parts = []

  let current = ''
  let depth = 0
  let i = 0

  while (i < src.length) {
    const ch = src[i]

    const comment = commentAt(src, i)
    if (comment) {
      current += comment.replacement
      i = comment.end
      continue
    }

    if (QUOTES.has(ch)) {
      const end = skipQuoted(src, i)
      current += src.slice(i, end)
      i = end
      continue
    }

    if (ch === '(') depth++
    else if (ch === ')') depth = Math.max(0, depth - 1)
    else if (depth === 0 && src.startsWith(separator, i)) {
      parts.push(current)
      current = ''
      i += separator.length
      continue
    }

    current += ch
    i++
  }

  parts.push(current)

  return parts.map((part) => part.trim()).filter(Boolean)
}

/**
 * Index of the parenthesis closing the group opened at `open`, or -1 when the
 * group is never closed. Quoting is respected, so a stray bracket inside a
 * string literal cannot end the group early.
 *
 * @param {string} text
 * @param {number} open index of the opening parenthesis
 * @returns {number}
 */
export function matchingParen(text, open) {
  const src = String(text ?? '')
  if (src[open] !== '(') return -1

  let depth = 0
  let i = open

  while (i < src.length) {
    const ch = src[i]

    const comment = commentAt(src, i)
    if (comment) {
      i = comment.end
      continue
    }

    if (QUOTES.has(ch)) {
      i = skipQuoted(src, i)
      continue
    }

    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return i
    }

    i++
  }

  return -1
}
