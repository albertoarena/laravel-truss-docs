import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Guards on the two workflow files, for the same reason htaccess.test.js exists:
// both encode a decision that is easy to undo by accident, and both fail in a
// way that looks like success.
//
// CI ran `npm run build` and nothing else, so the entire test suite gated
// nothing. Every check written for this site (that no page is missing its
// structured data, that no @id reference dangles, that the FAQ markup matches
// its visible text, that robots.txt and ai.txt cannot contradict each other)
// only ever ran when someone remembered to run it locally. A green tick on a
// pull request meant "it compiled".

const workflow = (name) =>
  readFileSync(fileURLToPath(new URL(`../.github/workflows/${name}`, import.meta.url)), 'utf8')

describe('CI', () => {
  const ci = workflow('ci.yml')

  it('runs the test suite', () => {
    expect(ci).toMatch(/vitest run|npm (run )?test/)
  })

  it('still builds, since the tests assert against dist/', () => {
    expect(ci).toContain('npm run build')
  })

  it('runs on pull requests, which is the point of gating', () => {
    expect(ci).toMatch(/^on:\s*\n\s*pull_request:/m)
  })
})

describe('both workflows check out full history', () => {
  // Starlight derives each page's last-updated date from the commit that last
  // touched it. At the default depth of one, every file resolves to the same
  // commit and every page claims the deploy date: a site-wide freshness claim
  // that is simply untrue, with nothing about the build that looks broken.
  for (const name of ['ci.yml', 'publish.yml']) {
    it(`${name} sets fetch-depth: 0`, () => {
      expect(workflow(name)).toMatch(/fetch-depth:\s*0/)
    })
  }
})
