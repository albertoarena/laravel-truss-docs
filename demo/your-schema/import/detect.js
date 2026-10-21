/**
 * Which of the accepted formats a paste is, or null.
 *
 * Sniffing is a convenience, never a gate: the dialog carries an explicit format
 * selector, and a wrong guess must be correctable rather than fatal. So this
 * errs towards null and lets the person say what they pasted.
 */

/** A JSON document is only a schema when it actually looks like one. */
function looksLikeTables(value) {
  const tables = Array.isArray(value) ? value : value?.tables

  if (!Array.isArray(tables)) return false
  if (tables.length === 0) return true

  return tables.some((table) => table && typeof table === 'object' && 'name' in table)
}

/**
 * @param {string} text
 * @returns {'truss-json' | 'mysql' | null}
 */
export function detectFormat(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return looksLikeTables(JSON.parse(trimmed)) ? 'truss-json' : null
    } catch {
      return null
    }
  }

  // Deliberately loose: a paste holding only the ALTER TABLE half of a dump is
  // still SQL, and telling somebody "that is not a schema" would be wrong.
  if (/\b(create\s+table|alter\s+table|create\s+(unique\s+)?index)\b/i.test(trimmed)) {
    return 'mysql'
  }

  return null
}
