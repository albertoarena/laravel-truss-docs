import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

// /.well-known/ai.txt is a second, more conventional discovery path to what
// llms.txt already says. A pointer, not a parallel index: one source of truth
// for the page list, so the two cannot disagree about what the site contains.
//
// The reason it needs its own tests is that it is prose. robots.txt is parsed by
// machines and drifts loudly; ai.txt is read as a statement of intent, and an
// overclaim here is worse. That exact failure has already happened on a sibling
// site, where ai.txt said all crawlers were welcome while the host was quietly
// returning 403 to three of them.

const distRoot = fileURLToPath(new URL('../dist', import.meta.url))
const read = (name) => readFileSync(join(distRoot, name), 'utf8')

const aiTxt = () => read('.well-known/ai.txt')

/** Agents robots.txt puts under a Disallow: / group. The enforced list. */
function disallowedInRobots() {
  const groups = read('robots.txt').split(/\n\s*\n/)
  return groups
    .filter((group) => /^Disallow:[ \t]*\/[ \t]*$/m.test(group))
    .flatMap((group) => [...group.matchAll(/^User-agent:[ \t]*(\S+)[ \t]*$/gm)].map((m) => m[1]))
}

/**
 * Agents ai.txt names as blocked.
 *
 * Keyed on a labelled line rather than "the first parenthetical in the file",
 * which is how the sibling site's version of this test was written and would
 * silently read the wrong thing the moment any earlier aside was added.
 */
function namedInAiTxt() {
  const line = aiTxt().match(/^Blocked by the hosting provider:[ \t]*(.+)$/m)
  return line ? line[1].split(',').map((agent) => agent.trim()) : []
}

describe('ai.txt', () => {
  it('is built at the well-known path', () => {
    expect(existsSync(join(distRoot, '.well-known/ai.txt'))).toBe(true)
  })

  it('points at the index rather than repeating it', () => {
    const text = aiTxt()
    expect(text).toContain('https://trussphp.com/llms.txt')
    expect(text).toContain('https://trussphp.com/llms-full.txt')
  })

  it('points only at files that exist', () => {
    expect(existsSync(join(distRoot, 'llms.txt'))).toBe(true)
    expect(existsSync(join(distRoot, 'llms-full.txt'))).toBe(true)
  })

  it('does not restate the page list, so it cannot drift from llms.txt', () => {
    // If this ever grows into a second index, the two will disagree.
    expect(aiTxt().length).toBeLessThan(read('llms.txt').length)
  })
})

describe('the crawler policy matches robots.txt', () => {
  it('names exactly the agents robots.txt disallows', () => {
    expect(namedInAiTxt().sort()).toEqual(disallowedInRobots().sort())
  })

  it('names at least one, so a broken parse cannot pass as agreement', () => {
    // Both sides returning nothing would satisfy the check above while proving
    // nothing at all.
    expect(namedInAiTxt().length).toBeGreaterThan(0)
  })

  it('never claims that all crawlers are welcome', () => {
    // The precise overclaim that went live on a sibling site. Three agents were
    // getting a 403 while this file said everything was welcome.
    expect(aiTxt().toLowerCase()).not.toMatch(/all crawlers.*welcome/)
  })

  it('says the block is the host rather than a preference', () => {
    // Whitespace collapsed first: this is a claim about what the file says, and
    // it should not start failing because a sentence got rewrapped.
    const text = aiTxt().toLowerCase().replace(/\s+/g, ' ')
    expect(text).toMatch(/hosting provider|waf/)
    expect(text).toMatch(/not a .*(preference|choice)/)
  })

  it('states the same content signals robots.txt grants', () => {
    const signal = read('robots.txt').match(/^Content-Signal:[ \t]*(.+)$/m)[1]
    for (const pair of signal.split(',').map((part) => part.trim())) {
      const [name] = pair.split('=')
      expect(aiTxt()).toContain(name)
    }
  })
})

describe('the contact address', () => {
  it('is the public one', () => {
    expect(aiTxt()).toContain('hello@albertoarena.it')
  })

  it('is never the private or the dismissed address', () => {
    // Both have reached published surfaces before. hello@ is the only address
    // that belongs anywhere a reader or a scraper can see.
    expect(aiTxt()).not.toContain('arena.alberto@gmail.com')
    expect(aiTxt()).not.toContain('me@albertoarena.it')
  })
})
