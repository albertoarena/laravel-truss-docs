import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { DEMO_APPS, appPageFile, appPagePath, APP_ASSET_TOKEN } from '../scripts/demo-apps.mjs'
import { STATIC_PAGES } from '../scripts/static-page-meta.mjs'

/**
 * The per-application demo pages: /demo/apps/<slug>/.
 *
 * Each renders a real open-source Laravel application's schema in the shipped
 * dashboard, from a static snapshot. Four ways this can go wrong were found on
 * the machine before the first page was written, and every one of them is
 * silent: the page loads, the shell paints, and the diagram is empty or the
 * copy is a claim nobody can check. Hence a file of its own.
 */

const root = fileURLToPath(new URL('..', import.meta.url))
const source = (app) => join(root, 'public', appPageFile(app))
const html = (app) => readFileSync(source(app), 'utf8')
const schemaPath = (app) => join(root, 'public', 'demo', 'apps', app.slug, 'schema.json')
const schema = (app) => JSON.parse(readFileSync(schemaPath(app), 'utf8'))

describe('the registry', () => {
  it('has at least one application, or none of this file means anything', () => {
    expect(DEMO_APPS.length).toBeGreaterThan(0)
  })

  it('gives every application a slug that is safe in a URL and a path', () => {
    for (const app of DEMO_APPS) {
      expect(app.slug, `${app.name} slug`).toMatch(/^[a-z0-9][a-z0-9-]*$/)
    }
  })

  it('names no application twice', () => {
    const slugs = DEMO_APPS.map((app) => app.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('ships both files for every application', () => {
    for (const app of DEMO_APPS) {
      expect(existsSync(source(app)), `${app.slug}: no page`).toBe(true)
      expect(existsSync(schemaPath(app)), `${app.slug}: no schema.json`).toBe(true)
    }
  })
})

describe('the snapshot is in the shape the dashboard reads', () => {
  // `truss:export --format=json` emits a BARE ARRAY of tables. The dashboard
  // does `state.tables = payload.tables ?? []` (truss.js:1265), so a bare array
  // yields zero tables and an empty diagram with no error anywhere: no console
  // warning, no banner, no failed request. The export has to be wrapped into an
  // object before it is committed, and this is what says so out loud.
  it('is an object with a tables array, not the bare array the exporter emits', () => {
    for (const app of DEMO_APPS) {
      const payload = schema(app)
      expect(Array.isArray(payload), `${app.slug}: the raw export was committed unwrapped`).toBe(false)
      expect(Array.isArray(payload.tables), `${app.slug}: no tables array`).toBe(true)
      expect(payload.tables.length, `${app.slug}: no tables`).toBeGreaterThan(0)
    }
  })

  it('carries the rest of the envelope the footer reads', () => {
    for (const app of DEMO_APPS) {
      const payload = schema(app)
      expect(payload, `${app.slug}`).toHaveProperty('connection')
      expect(payload, `${app.slug}`).toHaveProperty('generated_at')
      expect(payload.fallback, `${app.slug}: would show the SQLite fallback flag`).toBe(false)
    }
  })

  it('gives every table the fields the diagram is drawn from', () => {
    // mermaid-definition.js reads primary_key, foreign_keys[].columns and
    // foreign_keys[].references_table; a rename in a future export would draw
    // tables with no relationships between them and look merely sparse.
    for (const app of DEMO_APPS) {
      for (const table of schema(app).tables) {
        expect(typeof table.name, `${app.slug}`).toBe('string')
        expect(Array.isArray(table.columns), `${app.slug}: ${table.name}`).toBe(true)
        for (const fk of table.foreign_keys ?? []) {
          expect(typeof fk.references_table, `${app.slug}: ${table.name} fk`).toBe('string')
          expect(Array.isArray(fk.columns), `${app.slug}: ${table.name} fk`).toBe(true)
        }
      }
    }
  })
})

describe('no doctor panel, on any application page', () => {
  // The plan's one hard rule, and omitting a key is the whole of it: truss.js
  // sets `state.doctor = payload.doctor ?? null` and shows the Health button
  // only when that is not null (updateDoctorAvailability, truss.js:797). The
  // passive row flags are gated on the same value.
  //
  // The reason is not squeamishness. A maintainer should hear about their own
  // schema from a person, not from a search result on somebody else's website,
  // and the rule catalogue's counts are not stable yet. A page may gain a
  // findings section once that project's findings have been reported and
  // answered, and that will be a deliberate change to this test.
  it('ships no doctor payload in any snapshot', () => {
    for (const app of DEMO_APPS) {
      expect(schema(app), `${app.slug}`).not.toHaveProperty('doctor')
    }
  })

  it('ships no diff payload either, which would offer a Changes panel over nothing', () => {
    for (const app of DEMO_APPS) {
      expect(schema(app), `${app.slug}`).not.toHaveProperty('diff')
    }
  })

  it('turns the passive table flags off in the markup as well', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toMatch(/data-doctor-flag-tables="0"/)
    }
  })
})

describe('the assets the build renames', () => {
  // The failure that would have shipped. demoAssetVersioning renames assets/ to
  // assets-<version>/ and repoints only the literal tokens registered for each
  // page. These pages are two levels below demo/, so their token is ../../ and
  // not the ../ the other shells use. A page whose token is not registered
  // keeps pointing at demo/assets/, which no longer exists after the rename: it
  // renders perfectly under `npm run dev` and shows nothing in production.
  it('references the assets at the depth the page actually sits at', () => {
    for (const app of DEMO_APPS) {
      const page = html(app)
      expect(page, `${app.slug}: stylesheet`).toContain(`href="${APP_ASSET_TOKEN}truss.css"`)
      expect(page, `${app.slug}: dashboard module`).toContain(`src="${APP_ASSET_TOKEN}truss.js"`)
    }
  })

  it('spells every asset reference the one way the rewrite matches', () => {
    // Any other spelling survives the rewrite and then 404s. An absolute
    // /demo/assets/ path is the tempting version and the broken one.
    for (const app of DEMO_APPS) {
      const references = [...html(app).matchAll(/(?:src|href)="([^"]*assets\/[^"]*)"/g)].map((m) => m[1])
      expect(references.length, `${app.slug}: no asset references at all`).toBeGreaterThan(0)
      for (const reference of references) {
        expect(reference, `${app.slug}: ${reference} is not a token the build rewrites`)
          .toMatch(new RegExp(`^${APP_ASSET_TOKEN.replace(/[.\\]/g, '\\$&')}`))
      }
    }
  })

  it('is registered in astro.config.mjs through the registry, not by hand', () => {
    // Reading the config as text, because the alternative is trusting that
    // whoever adds the twentieth application also edits four lists.
    const config = readFileSync(join(root, 'astro.config.mjs'), 'utf8')
    expect(config).toContain('APP_ASSET_TOKEN')
    expect(config).toMatch(/DEMO_APPS\.map/)
  })
})

describe('the page lands somewhere legible', () => {
  it('focuses a table that exists in its own schema', () => {
    // A focus naming a table that is not there is not an error the dashboard
    // reports: setFocus validates the name and quietly declines, so the page
    // lands on the whole schema instead, which for 67 tables is the outcome
    // focusing exists to avoid.
    for (const app of DEMO_APPS) {
      const names = schema(app).tables.map((table) => table.name)
      expect(names, `${app.slug}: focus table ${app.focus} is not in the schema`).toContain(app.focus)
    }
  })

  it('seeds that focus from the shell, before the dashboard reads the URL', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toContain(`focus=${app.focus}`)
      expect(html(app), `${app.slug}: seeding must not create a history entry`).toMatch(/replaceState/)
    }
  })

  it('leaves a shared link alone, so a bookmarked view reopens as it was', () => {
    expect(html(DEMO_APPS[0])).toMatch(/if \(window\.location\.search\) return/)
  })
})

describe('the copy on the page can be checked against the file', () => {
  // The number is the thing most likely to be wrong and the least likely to be
  // noticed. The field study counts Laravel's own scaffolding and Truss does
  // not export it, so the same application is 75 tables there and 67 here.
  // Both are true and they are different claims, and the page prints one of
  // them in the heading strip.
  it('states the table count the snapshot actually holds', () => {
    for (const app of DEMO_APPS) {
      expect(schema(app).tables.length, `${app.slug}: registry count is stale`).toBe(app.tables)
      expect(html(app), `${app.slug}: the page prints a count the file does not support`)
        .toContain(`${app.tables} tables`)
    }
  })

  it('states the foreign key count the snapshot actually holds', () => {
    for (const app of DEMO_APPS) {
      const total = schema(app).tables.reduce((n, t) => n + (t.foreign_keys?.length ?? 0), 0)
      expect(total, `${app.slug}: registry count is stale`).toBe(app.foreignKeys)
    }
  })

  it('says which count it means, rather than leaving the two to be conflated', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}: nothing reconciles this count with the field study's`)
        .toMatch(/scaffolding/i)
    }
  })
})

describe('the courtesies owed to somebody else\'s schema', () => {
  it('links the project\'s own repository, prominently rather than in a footer', () => {
    for (const app of DEMO_APPS) {
      const page = html(app)
      expect(page, `${app.slug}`).toContain(app.repository)
      // Above the dashboard, not below it: the repository link has to appear
      // before the app element in the document.
      expect(page.indexOf(app.repository), `${app.slug}: repository link is below the diagram`)
        .toBeLessThan(page.indexOf('id="truss-app"'))
    }
  })

  it('names the version and the licence it was checked under', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toContain(app.version)
      expect(html(app), `${app.slug}`).toContain(app.licence)
    }
  })

  it('dates the snapshot, so it is a dated record rather than a standing claim', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toContain(app.snapshot)
    }
  })

  it('says on the page how to ask for it to be taken down', () => {
    // Third-party material, so the answer to an objection is removal and the
    // way to object has to be on the page. Same address /in-the-wild/ publishes.
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toContain('mailto:hello@albertoarena.it')
    }
  })

  it('claims no affiliation it does not have', () => {
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toMatch(/not affiliated/i)
    }
  })
})

describe('the head metadata every other page gets', () => {
  it('has an entry per application, at the path the page is built to', () => {
    for (const app of DEMO_APPS) {
      const entry = STATIC_PAGES.find((page) => page.path === appPagePath(app))
      expect(entry, `${app.slug} is missing from STATIC_PAGES`).toBeTruthy()
      expect(entry.file).toBe(appPageFile(app))
    }
  })

  it('gives the page the same title the head already carries', () => {
    // staticPageMeta injects a description and an og:title but never touches
    // <title>, and the output test asserts the two agree, so a mismatch here
    // fails at build rather than shipping two different names for one page.
    for (const app of DEMO_APPS) {
      expect(html(app), `${app.slug}`).toContain(`<title>${app.title}</title>`)
    }
  })

  it('names the application in its own title, since that is the query it answers', () => {
    for (const app of DEMO_APPS) {
      expect(app.title, `${app.slug}`).toContain(app.name)
    }
  })
})
