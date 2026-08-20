import { describe, it, expect } from 'vitest'

import { parseMysql } from '../public/demo/your-schema/import/mysql.js'

// The target shape is SchemaSerializer::table() from the package: name, columns
// (name / type / nullable / default), primary_key, indexes, foreign_keys. The
// primary key is hoisted out of the index list there, so it must be hoisted out
// here too.

const table = (result, name) => result.tables.find((t) => t.name === name)

describe('parseMysql: tables and columns', () => {
  it('reads a table name out of backticks', () => {
    const out = parseMysql('CREATE TABLE `users` (`id` bigint unsigned NOT NULL);')

    expect(out.tables).toHaveLength(1)
    expect(out.tables[0].name).toBe('users')
  })

  it('reads an unquoted table name', () => {
    expect(parseMysql('CREATE TABLE users (id int);').tables[0].name).toBe('users')
  })

  it('drops the database qualifier from a schema-qualified name', () => {
    const out = parseMysql('CREATE TABLE `app`.`users` (`id` int);')

    expect(out.tables[0].name).toBe('users')
  })

  it('accepts IF NOT EXISTS', () => {
    expect(parseMysql('CREATE TABLE IF NOT EXISTS `users` (`id` int);').tables[0].name).toBe(
      'users',
    )
  })

  it('accepts a temporary table', () => {
    expect(parseMysql('CREATE TEMPORARY TABLE `t` (`id` int);').tables[0].name).toBe('t')
  })

  it('keeps the native type, lowercased, with its arguments', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` BIGINT UNSIGNED NOT NULL, `b` VARCHAR(255) NOT NULL, `c` DECIMAL(10,2) NOT NULL);',
    )

    expect(out.tables[0].columns.map((c) => c.type)).toEqual([
      'bigint unsigned',
      'varchar(255)',
      'decimal(10,2)',
    ])
  })

  it('preserves the case of enum members while lowercasing the type', () => {
    // MySQL reports enum('Draft','Published'): the keyword is lowercased, the
    // members are values and are not.
    const out = parseMysql("CREATE TABLE `t` (`s` ENUM('Draft','Published') NOT NULL);")

    expect(out.tables[0].columns[0].type).toBe("enum('Draft','Published')")
  })

  it('keeps a comma inside an enum member out of the column split', () => {
    const out = parseMysql("CREATE TABLE `t` (`s` enum('a,b','c') NOT NULL, `n` int);")

    expect(out.tables[0].columns.map((c) => c.name)).toEqual(['s', 'n'])
    expect(out.tables[0].columns[0].type).toBe("enum('a,b','c')")
  })

  it('keeps multi-word type names together', () => {
    const out = parseMysql('CREATE TABLE `t` (`a` DOUBLE PRECISION, `b` int);')

    expect(out.tables[0].columns[0].type).toBe('double precision')
  })

  it('leaves the character set and collation out of the type', () => {
    // information_schema reports those in their own columns, not in COLUMN_TYPE.
    const out = parseMysql(
      "CREATE TABLE `t` (`a` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL);",
    )

    expect(out.tables[0].columns[0].type).toBe('varchar(255)')
  })

  it('leaves auto_increment and a column comment out of the type', () => {
    const out = parseMysql(
      "CREATE TABLE `t` (`id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'the id');",
    )

    expect(out.tables[0].columns[0].type).toBe('bigint unsigned')
  })

  it('reads nullability, defaulting to nullable when nothing is said', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int NOT NULL, `b` int NULL, `c` int, `d` int DEFAULT NULL);',
    )

    expect(out.tables[0].columns.map((c) => c.nullable)).toEqual([false, true, true, true])
  })

  it('reads defaults, unquoting a string literal', () => {
    const out = parseMysql(
      "CREATE TABLE `t` (`a` varchar(20) NOT NULL DEFAULT 'draft', `b` int NOT NULL DEFAULT 0, `c` timestamp NULL DEFAULT CURRENT_TIMESTAMP, `d` int DEFAULT NULL, `e` int NOT NULL);",
    )

    expect(out.tables[0].columns.map((c) => c.default)).toEqual([
      'draft',
      '0',
      'CURRENT_TIMESTAMP',
      null,
      null,
    ])
  })

  it('unescapes a doubled quote inside a default', () => {
    const out = parseMysql("CREATE TABLE `t` (`a` varchar(20) DEFAULT 'it''s');")

    expect(out.tables[0].columns[0].default).toBe("it's")
  })

  it('does not mistake ON UPDATE CURRENT_TIMESTAMP for a default', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP);',
    )

    expect(out.tables[0].columns[0].default).toBe('CURRENT_TIMESTAMP')
  })

  it('reads a generated column without losing the ones after it', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, `b` int GENERATED ALWAYS AS (`a` + 1) STORED, `c` int);',
    )

    expect(out.tables[0].columns.map((c) => c.name)).toEqual(['a', 'b', 'c'])
    expect(out.tables[0].columns[1].type).toBe('int')
  })
})

describe('parseMysql: keys', () => {
  it('hoists an inline primary key out of the index list', () => {
    const out = parseMysql('CREATE TABLE `t` (`id` bigint unsigned NOT NULL PRIMARY KEY);')

    expect(out.tables[0].primary_key).toEqual(['id'])
    expect(out.tables[0].indexes).toEqual([])
  })

  it('reads a table-level primary key', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`id` bigint unsigned NOT NULL, PRIMARY KEY (`id`));',
    )

    expect(out.tables[0].primary_key).toEqual(['id'])
  })

  it('reads a composite primary key in declared order', () => {
    const out = parseMysql(
      'CREATE TABLE `role_user` (`role_id` bigint unsigned NOT NULL, `user_id` bigint unsigned NOT NULL, PRIMARY KEY (`role_id`,`user_id`));',
    )

    expect(table(out, 'role_user').primary_key).toEqual(['role_id', 'user_id'])
  })

  it('forces a primary key column to be not nullable', () => {
    // MySQL makes a primary key column NOT NULL whether the DDL says so or not.
    const out = parseMysql('CREATE TABLE `t` (`id` int, PRIMARY KEY (`id`));')

    expect(out.tables[0].columns[0].nullable).toBe(false)
  })

  it('reads ordinary and unique keys as indexes', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, `b` int, KEY `t_a_index` (`a`), UNIQUE KEY `t_b_unique` (`b`));',
    )

    expect(out.tables[0].indexes).toEqual([
      { name: 't_a_index', columns: ['a'], unique: false },
      { name: 't_b_unique', columns: ['b'], unique: true },
    ])
  })

  it('accepts INDEX as a synonym for KEY', () => {
    const out = parseMysql('CREATE TABLE `t` (`a` int, INDEX `i` (`a`));')

    expect(out.tables[0].indexes[0]).toEqual({ name: 'i', columns: ['a'], unique: false })
  })

  it('strips a prefix length and a sort direction from index columns', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` varchar(255), `b` int, KEY `i` (`a`(10),`b` DESC));',
    )

    expect(out.tables[0].indexes[0].columns).toEqual(['a', 'b'])
  })

  it('reads a fulltext key as an index', () => {
    const out = parseMysql('CREATE TABLE `t` (`a` text, FULLTEXT KEY `ft` (`a`));')

    expect(out.tables[0].indexes[0]).toEqual({ name: 'ft', columns: ['a'], unique: false })
  })

  it('ignores a check constraint', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, CONSTRAINT `chk` CHECK (`a` > 0));',
    )

    expect(out.tables[0].indexes).toEqual([])
    expect(out.tables[0].foreign_keys).toEqual([])
  })
})

describe('parseMysql: foreign keys', () => {
  it('reads a named foreign key with its referential actions', () => {
    const out = parseMysql(
      'CREATE TABLE `posts` (`user_id` bigint unsigned NOT NULL, CONSTRAINT `posts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE);',
    )

    expect(out.tables[0].foreign_keys).toEqual([
      {
        name: 'posts_user_id_foreign',
        columns: ['user_id'],
        references_table: 'users',
        references_columns: ['id'],
        on_update: null,
        on_delete: 'cascade',
      },
    ])
  })

  it('reads both referential actions in either order', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, CONSTRAINT `f` FOREIGN KEY (`a`) REFERENCES `u` (`id`) ON UPDATE RESTRICT ON DELETE SET NULL);',
    )

    expect(out.tables[0].foreign_keys[0].on_update).toBe('restrict')
    expect(out.tables[0].foreign_keys[0].on_delete).toBe('set null')
  })

  it('reads a foreign key spread over two columns', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, `b` int, CONSTRAINT `f` FOREIGN KEY (`a`,`b`) REFERENCES `u` (`x`,`y`));',
    )

    expect(out.tables[0].foreign_keys[0].columns).toEqual(['a', 'b'])
    expect(out.tables[0].foreign_keys[0].references_columns).toEqual(['x', 'y'])
  })

  it('reads a foreign key declared without a CONSTRAINT name', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int, FOREIGN KEY (`a`) REFERENCES `u` (`id`));',
    )

    expect(out.tables[0].foreign_keys[0].columns).toEqual(['a'])
    expect(out.tables[0].foreign_keys[0].name).toBeTruthy()
  })

  it('does not invent a foreign key from a column that merely looks like one', () => {
    // The single most damaging thing this parser could do. A user_id column with
    // no constraint on it is not a relationship, and drawing one would be a lie
    // about the schema on the page that sells the product.
    const out = parseMysql(
      'CREATE TABLE `posts` (`id` bigint unsigned NOT NULL, `user_id` bigint unsigned NOT NULL, `team_id` bigint unsigned DEFAULT NULL, PRIMARY KEY (`id`));',
    )

    expect(out.tables[0].foreign_keys).toEqual([])
  })

  it('honours a column-level REFERENCES clause', () => {
    const out = parseMysql(
      'CREATE TABLE `t` (`a` int REFERENCES `u` (`id`) ON DELETE CASCADE);',
    )

    expect(out.tables[0].foreign_keys[0].references_table).toBe('u')
    expect(out.tables[0].foreign_keys[0].on_delete).toBe('cascade')
  })
})

describe('parseMysql: constraints added after the tables', () => {
  it('applies a foreign key added by a trailing ALTER TABLE', () => {
    const sql = [
      'CREATE TABLE `users` (`id` bigint unsigned NOT NULL, PRIMARY KEY (`id`));',
      'CREATE TABLE `posts` (`id` bigint unsigned NOT NULL, `user_id` bigint unsigned NOT NULL, PRIMARY KEY (`id`));',
      'ALTER TABLE `posts` ADD CONSTRAINT `posts_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;',
    ].join('\n')

    expect(table(parseMysql(sql), 'posts').foreign_keys[0]).toEqual({
      name: 'posts_user_id_foreign',
      columns: ['user_id'],
      references_table: 'users',
      references_columns: ['id'],
      on_update: null,
      on_delete: 'cascade',
    })
  })

  it('applies several additions in one ALTER TABLE', () => {
    const sql = [
      'CREATE TABLE `t` (`a` int, `b` int);',
      'ALTER TABLE `t` ADD PRIMARY KEY (`a`), ADD UNIQUE KEY `t_b_unique` (`b`), ADD KEY `t_a_index` (`a`);',
    ].join('\n')

    const t = table(parseMysql(sql), 't')

    expect(t.primary_key).toEqual(['a'])
    expect(t.indexes).toEqual([
      { name: 't_b_unique', columns: ['b'], unique: true },
      { name: 't_a_index', columns: ['a'], unique: false },
    ])
  })

  it('applies a standalone CREATE INDEX', () => {
    const sql = [
      'CREATE TABLE `t` (`a` int);',
      'CREATE UNIQUE INDEX `t_a_unique` ON `t` (`a`);',
    ].join('\n')

    expect(table(parseMysql(sql), 't').indexes[0]).toEqual({
      name: 't_a_unique',
      columns: ['a'],
      unique: true,
    })
  })

  it('ignores an ALTER TABLE that is not adding a key', () => {
    const sql = [
      'CREATE TABLE `t` (`a` int);',
      '/*!40000 ALTER TABLE `t` DISABLE KEYS */;',
      'ALTER TABLE `t` MODIFY `a` int NOT NULL AUTO_INCREMENT;',
    ].join('\n')

    const out = parseMysql(sql)

    expect(out.unrecognised).toEqual([])
    expect(table(out, 't').indexes).toEqual([])
  })

  it('records an addition naming a table that is not in the file', () => {
    const sql = 'ALTER TABLE `absent` ADD PRIMARY KEY (`a`);'

    expect(parseMysql(sql).unrecognised).toHaveLength(1)
  })
})

describe('parseMysql: what it refuses to do quietly', () => {
  it('ignores INSERT statements and counts them', () => {
    // The promise made on the page is that no row data is read. This is what
    // turns that into something a visitor watches happen.
    const sql = [
      'CREATE TABLE `t` (`a` int);',
      "INSERT INTO `t` VALUES (1),(2),(3);",
      "INSERT INTO `t` VALUES (4);",
    ].join('\n')

    const out = parseMysql(sql)

    expect(out.ignored.INSERT).toBe(2)
    expect(out.tables[0].columns).toHaveLength(1)
  })

  it('counts the other statements a dump is padded with', () => {
    const sql = [
      '/*!40101 SET NAMES utf8mb4 */;',
      'DROP TABLE IF EXISTS `t`;',
      'CREATE TABLE `t` (`a` int);',
      'LOCK TABLES `t` WRITE;',
      'UNLOCK TABLES;',
    ].join('\n')

    const out = parseMysql(sql)

    expect(out.ignored.SET).toBe(1)
    expect(out.ignored.DROP).toBe(1)
    expect(out.ignored.LOCK).toBe(1)
    expect(out.ignored.UNLOCK).toBe(1)
    expect(out.unrecognised).toEqual([])
  })

  it('reports a statement it does not understand, with its line', () => {
    const sql = ['CREATE TABLE `t` (`a` int);', '', 'WOBBLE THE THING;'].join('\n')

    const out = parseMysql(sql)

    expect(out.unrecognised).toHaveLength(1)
    expect(out.unrecognised[0].line).toBe(3)
    expect(out.unrecognised[0].snippet).toContain('WOBBLE')
  })

  it('keeps going after a table it cannot parse', () => {
    // Unbalanced parenthesis, terminated. One bad statement must not cost the
    // visitor the rest of their schema.
    const sql = [
      'CREATE TABLE `broken` (`a` int;',
      'CREATE TABLE `fine` (`a` int);',
    ].join('\n')

    const out = parseMysql(sql)

    expect(table(out, 'fine')).toBeTruthy()
    expect(out.unrecognised).toHaveLength(1)
  })

  it('finds no tables in a data-only dump', () => {
    const out = parseMysql("INSERT INTO `t` VALUES (1);")

    expect(out.tables).toEqual([])
    expect(out.ignored.INSERT).toBe(1)
  })
})

describe('parseMysql: the schema built to break a parser', () => {
  // Composite primary key, a foreign key over two columns, constraints added by
  // a trailing ALTER TABLE, and a column that looks like a key but carries no
  // constraint. All four in one file, since they interact.
  const sql = [
    'CREATE TABLE `teams` (',
    '  `id` bigint unsigned NOT NULL AUTO_INCREMENT,',
    '  `slug` varchar(255) NOT NULL,',
    '  PRIMARY KEY (`id`),',
    '  UNIQUE KEY `teams_slug_unique` (`slug`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
    '',
    'CREATE TABLE `memberships` (',
    '  `team_id` bigint unsigned NOT NULL,',
    '  `user_id` bigint unsigned NOT NULL,',
    "  `role` enum('owner','admin','member') NOT NULL DEFAULT 'member',",
    '  `invited_by_id` bigint unsigned DEFAULT NULL,',
    '  PRIMARY KEY (`team_id`,`user_id`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
    '',
    'CREATE TABLE `assignments` (',
    '  `team_id` bigint unsigned NOT NULL,',
    '  `user_id` bigint unsigned NOT NULL,',
    '  `note` varchar(255) DEFAULT NULL,',
    '  KEY `assignments_team_id_user_id_index` (`team_id`,`user_id`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
    '',
    'ALTER TABLE `assignments`',
    '  ADD CONSTRAINT `assignments_membership_foreign`',
    '  FOREIGN KEY (`team_id`,`user_id`) REFERENCES `memberships` (`team_id`,`user_id`) ON DELETE CASCADE;',
  ].join('\n')

  const out = parseMysql(sql)

  it('finds all three tables', () => {
    expect(out.tables.map((t) => t.name)).toEqual(['teams', 'memberships', 'assignments'])
  })

  it('reads the composite primary key', () => {
    expect(table(out, 'memberships').primary_key).toEqual(['team_id', 'user_id'])
  })

  it('reads the enum with its default', () => {
    const role = table(out, 'memberships').columns.find((c) => c.name === 'role')

    expect(role.type).toBe("enum('owner','admin','member')")
    expect(role.default).toBe('member')
  })

  it('reads the two-column foreign key added afterwards', () => {
    expect(table(out, 'assignments').foreign_keys).toEqual([
      {
        name: 'assignments_membership_foreign',
        columns: ['team_id', 'user_id'],
        references_table: 'memberships',
        references_columns: ['team_id', 'user_id'],
        on_update: null,
        on_delete: 'cascade',
      },
    ])
  })

  it('draws no relationship from invited_by_id, which has no constraint', () => {
    expect(table(out, 'memberships').foreign_keys).toEqual([])
  })

  it('understands the whole file', () => {
    expect(out.unrecognised).toEqual([])
  })
})

describe('parseMysql: a definition it cannot make sense of', () => {
  // Found by pasting a real dump with one word inserted into a column
  // definition. The parser read that word as the type, drew a column typed
  // "dummy", and said nothing. Nothing about the file was reported as odd, so
  // the only signal was noticing it on the diagram.
  const sql = 'CREATE TABLE `credentials` (\n  `id` bigint unsigned NOT NULL,\n  `workspace_id` dummy bigint unsigned NOT NULL\n);'

  it('reports a column type it does not recognise', () => {
    const out = parseMysql(sql)

    expect(out.problems).toEqual([
      {
        kind: 'unknown-column-type',
        detail: 'credentials.workspace_id has the type "dummy", which is not a MySQL type. Drawn as written.',
      },
    ])
  })

  it('still draws the column, since dropping it would cascade', () => {
    // The column carries keys and constraints elsewhere in a real dump. Losing
    // it silently is worse than showing it with the type that was written.
    const out = parseMysql(sql)

    expect(out.tables[0].columns.map((c) => c.name)).toEqual(['id', 'workspace_id'])
  })

  it('says nothing about the ordinary types', () => {
    const out = parseMysql(
      "CREATE TABLE `t` (`a` bigint unsigned, `b` varchar(1), `c` enum('x'), `d` decimal(8,2), `e` json, `f` longtext, `g` double precision, `h` timestamp, `i` tinyint(1), `j` geometry);",
    )

    expect(out.problems).toEqual([])
  })
})
