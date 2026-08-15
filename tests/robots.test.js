import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

import { ANSWER_ENGINE_AGENTS, KNOWN_BLOCKED_AGENTS } from '../scripts/machine-access.mjs'

// Until now this site had no robots.txt of its own. While it was proxied,
// Cloudflare served its own managed content-signals boilerplate in place of one:
// 24 lines, every one a comment, with no User-agent, no Allow, no Disallow, no
// Sitemap line, and no signal actually set. Going DNS only removed even that, so
// the path 404s. A missing robots.txt reads as "crawl everything", so nothing was
// broken, but there was no way to point at the sitemap and no way to state a
// crawler policy.
//
// Asserted against dist/ rather than public/, because what matters is what ships.

const dist = (path) => fileURLToPath(new URL(`../dist/${path}`, import.meta.url))
const robots = () => readFileSync(dist('robots.txt'), 'utf8')

/** The agent tokens in a group, in robots.txt terms: consecutive User-agent lines. */
function groups(text) {
  return text
    .split(/\n\s*\n/)
    .map((block) => ({
      // [ \t]* rather than \s*: \s matches newlines, so a bare "Disallow:" would
      // swallow the following line and report it as its own value.
      agents: [...block.matchAll(/^User-agent:[ \t]*(\S+)[ \t]*$/gm)].map((match) => match[1]),
      directives: [...block.matchAll(/^(Disallow|Allow|Content-Signal):[ \t]*(.*)$/gm)].map((match) => [
        match[1],
        match[2].trim(),
      ]),
    }))
    .filter((group) => group.agents.length > 0)
}

const wildcard = (text) => groups(text).find((group) => group.agents.includes('*'))
const blocked = (text) => groups(text).filter((group) => !group.agents.includes('*'))

describe('robots.txt', () => {
  it('ships in the built output', () => {
    expect(existsSync(dist('robots.txt'))).toBe(true)
  })

  it('lets everything crawl everything by default', () => {
    const group = wildcard(robots())
    expect(group).toBeDefined()
    // "Disallow:" with nothing after it is the allow-all form. Anything after it
    // would silently withhold part of the site.
    for (const [name, value] of group.directives) {
      if (name === 'Disallow') expect(value).toBe('')
    }
  })

  it('declares the content signal, including the training decision', () => {
    const group = wildcard(robots())
    const signal = group.directives.find(([name]) => name === 'Content-Signal')?.[1]

    expect(signal).toBeDefined()
    expect(signal).toContain('search=yes')
    expect(signal).toContain('ai-input=yes')
    // Decided deliberately rather than left open: the package is MIT licensed
    // and the point of this work is that models should know it exists.
    expect(signal).toContain('ai-train=yes')
  })

  it('points at the sitemap that actually exists', () => {
    const match = robots().match(/^Sitemap:\s*(\S+)$/m)
    expect(match).not.toBeNull()

    const url = match[1]
    expect(url).toBe('https://trussphp.com/sitemap-index.xml')
    // The pointer is worthless if the target is not built.
    expect(existsSync(dist('sitemap-index.xml'))).toBe(true)
  })
})

describe('the host-blocked crawler disclosure', () => {
  // Netsons' WAF 403s three bulk training crawlers account-wide. That is not
  // ours to lift and it does not affect AEO, so it is declared rather than
  // fought: a crawler given a clean Disallow stops, while one given an
  // unexplained 403 on every request may retry or lose trust in the host.

  it('names exactly the agents the host blocks', () => {
    const declared = blocked(robots()).flatMap((group) => group.agents)
    expect([...declared].sort()).toEqual([...KNOWN_BLOCKED_AGENTS].sort())
  })

  it('disallows them entirely, matching what the host enforces', () => {
    for (const group of blocked(robots())) {
      expect(group.directives).toContainEqual(['Disallow', '/'])
    }
  })

  it('never disallows an answer-time agent, whatever else changes here', () => {
    // The guard that matters. Adding Claude-User or OAI-SearchBot to this group
    // would silently opt the site out of being cited, which is the entire thing
    // this work exists to achieve.
    const declared = blocked(robots()).flatMap((group) => group.agents)
    for (const agent of ANSWER_ENGINE_AGENTS) {
      expect(declared).not.toContain(agent)
    }
  })

  it('says in the file itself that this is the host, not a preference', () => {
    // Someone reading only robots.txt should not conclude the site chose this.
    const comments = robots()
      .split('\n')
      .filter((line) => line.startsWith('#'))
      .join(' ')
      .toLowerCase()

    expect(comments).toMatch(/hosting provider|host-level|waf/)
    expect(comments).toMatch(/not .*(preference|choice)/)
  })
})
