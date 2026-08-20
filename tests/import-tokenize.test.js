import { describe, it, expect } from 'vitest'

import {
  splitStatements,
  splitTopLevel,
  matchingParen,
} from '../public/demo/your-schema/import/tokenize.js'

// Splitting a dump into statements is the part that a regex gets wrong, and it
// gets it wrong quietly: a semicolon inside a string literal or a comment ends a
// statement early, and the half a parser then sees still looks parseable. Every
// case here comes from something mysqldump actually emits.

describe('splitStatements', () => {
  it('splits on semicolons and drops the terminator', () => {
    const out = splitStatements('SELECT 1; SELECT 2;')

    expect(out.map((s) => s.text)).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('ignores a trailing statement with no semicolon', () => {
    // A hand-pasted CREATE TABLE often has no final semicolon.
    expect(splitStatements('CREATE TABLE a (id int)').map((s) => s.text)).toEqual([
      'CREATE TABLE a (id int)',
    ])
  })

  it('emits nothing for whitespace or an empty string', () => {
    expect(splitStatements('')).toEqual([])
    expect(splitStatements('   \n\n  ')).toEqual([])
    expect(splitStatements(';;;')).toEqual([])
  })

  it('does not split on a semicolon inside a single-quoted string', () => {
    const sql = "INSERT INTO a VALUES ('one; two'); SELECT 1;"

    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      "INSERT INTO a VALUES ('one; two')",
      'SELECT 1',
    ])
  })

  it('understands a doubled quote as an escaped quote', () => {
    const sql = "SELECT 'it''s; fine'; SELECT 2;"

    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      "SELECT 'it''s; fine'",
      'SELECT 2',
    ])
  })

  it('understands a backslash-escaped quote', () => {
    const sql = "SELECT 'a\\'; b'; SELECT 2;"

    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      "SELECT 'a\\'; b'",
      'SELECT 2',
    ])
  })

  it('does not split inside a backquoted identifier', () => {
    const sql = 'CREATE TABLE `we;ird` (id int); SELECT 1;'

    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      'CREATE TABLE `we;ird` (id int)',
      'SELECT 1',
    ])
  })

  it('does not split inside a double-quoted string', () => {
    expect(splitStatements('SELECT "a; b"; SELECT 2;').map((s) => s.text)).toEqual([
      'SELECT "a; b"',
      'SELECT 2',
    ])
  })

  it('strips line comments introduced by two dashes', () => {
    const sql = ['-- Host: localhost; Database: app', 'SELECT 1;'].join('\n')

    expect(splitStatements(sql).map((s) => s.text)).toEqual(['SELECT 1'])
  })

  it('strips line comments introduced by a hash', () => {
    expect(splitStatements('# a comment; still\nSELECT 1;').map((s) => s.text)).toEqual([
      'SELECT 1',
    ])
  })

  it('leaves two dashes inside a string alone', () => {
    expect(splitStatements("SELECT 'a -- b';").map((s) => s.text)).toEqual([
      "SELECT 'a -- b'",
    ])
  })

  it('strips block comments, including ones holding a semicolon', () => {
    // Replaced by a single space rather than nothing, since a comment is a token
    // separator: a/**/b is two tokens, not one.
    const sql = 'SELECT 1/* keep; going */, 2;'

    expect(splitStatements(sql).map((s) => s.text)).toEqual(['SELECT 1 , 2'])
  })

  it('unwraps a MySQL executable comment and keeps the SQL inside it', () => {
    // mysqldump wraps version-gated statements this way, and the body is real
    // SQL that a stripper would throw away along with the marker.
    const sql = '/*!40101 SET NAMES utf8mb4 */;\nSELECT 1;'

    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      'SET NAMES utf8mb4',
      'SELECT 1',
    ])
  })

  it('honours a DELIMITER change and restores it afterwards', () => {
    // The classic splitter breaker: a trigger body full of semicolons.
    const sql = [
      'DELIMITER ;;',
      'CREATE TRIGGER t BEFORE INSERT ON a FOR EACH ROW BEGIN SET @x = 1; SET @y = 2; END;;',
      'DELIMITER ;',
      'SELECT 1;',
    ].join('\n')

    const out = splitStatements(sql).map((s) => s.text)

    expect(out).toHaveLength(2)
    expect(out[0]).toContain('CREATE TRIGGER')
    expect(out[0]).toContain('SET @y = 2')
    expect(out[1]).toBe('SELECT 1')
  })

  it('reports the line each statement starts on', () => {
    const sql = ['-- a comment', '', 'SELECT 1;', '', 'SELECT 2;'].join('\n')

    expect(splitStatements(sql)).toEqual([
      { text: 'SELECT 1', line: 3 },
      { text: 'SELECT 2', line: 5 },
    ])
  })

  it('counts lines through a multi-line statement', () => {
    const sql = ['CREATE TABLE a (', '  id int', ');', 'SELECT 1;'].join('\n')
    const out = splitStatements(sql)

    expect(out[0].line).toBe(1)
    expect(out[1].line).toBe(4)
  })

  it('handles a large input without blowing the stack or hanging', () => {
    const sql = Array.from({ length: 5000 }, (_, i) => `SELECT ${i};`).join('\n')

    expect(splitStatements(sql)).toHaveLength(5000)
  })
})

describe('splitTopLevel', () => {
  it('splits a simple list', () => {
    expect(splitTopLevel('a, b, c')).toEqual(['a', 'b', 'c'])
  })

  it('does not split inside parentheses', () => {
    expect(splitTopLevel('a decimal(10,2), b int')).toEqual(['a decimal(10,2)', 'b int'])
  })

  it('does not split inside nested parentheses', () => {
    expect(splitTopLevel('a int, b as (concat(x, y)), c int')).toEqual([
      'a int',
      'b as (concat(x, y))',
      'c int',
    ])
  })

  it('does not split inside a quoted string', () => {
    // The enum case is the one that matters: its members are a comma list of
    // string literals that may themselves contain commas.
    expect(splitTopLevel("a enum('x,y','z'), b int")).toEqual([
      "a enum('x,y','z')",
      'b int',
    ])
  })

  it('does not split inside a backquoted identifier', () => {
    expect(splitTopLevel('`we,ird` int, b int')).toEqual(['`we,ird` int', 'b int'])
  })

  it('drops empty segments and trims', () => {
    expect(splitTopLevel('  a  ,,  b  ')).toEqual(['a', 'b'])
  })

  it('returns nothing for an empty list', () => {
    expect(splitTopLevel('')).toEqual([])
    expect(splitTopLevel('   ')).toEqual([])
  })
})

describe('matchingParen', () => {
  it('finds the closing paren of the group opened at the given index', () => {
    const text = 'CREATE TABLE a (id int, b decimal(10,2)) ENGINE=InnoDB'
    const open = text.indexOf('(')

    expect(matchingParen(text, open)).toBe(text.lastIndexOf(')'))
  })

  it('ignores parentheses inside strings', () => {
    const text = "(a enum('(',')'))"

    expect(matchingParen(text, 0)).toBe(text.length - 1)
  })

  it('returns -1 when the group is never closed', () => {
    expect(matchingParen('(a int', 0)).toBe(-1)
  })
})
