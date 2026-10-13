import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// trussphp.com's DNS record at Cloudflare is DNS only, never proxied: the
// proxy was turned off after the 2026-08-15 incident (see
// machine-access.test.js). The privacy page went on saying Cloudflare served
// the site as a reverse proxy and handled every request, which overstated what
// a third party sees. Cloudflare answers the DNS lookup and, separately, runs
// the cookieless analytics beacon. It never sees the pages requested.
const privacy = readFileSync(
  fileURLToPath(new URL('../src/content/docs/privacy.mdx', import.meta.url)),
  'utf8',
)

const cloudflareRow = privacy.split('\n').find((line) => /^\|\s*Cloudflare\s*\|/.test(line))

describe('the privacy page describes Cloudflare as DNS only', () => {
  it('never says the site is proxied', () => {
    expect(privacy).not.toMatch(/prox(y|ies)/i)
  })

  it('never says Cloudflare sees every request', () => {
    expect(privacy).not.toMatch(/Cloudflare[^\n]*every request/i)
  })

  it('lists Cloudflare as DNS only in the third parties table', () => {
    expect(cloudflareRow).toBeDefined()
    expect(cloudflareRow).toMatch(/DNS only/)
  })

  it('still names Cloudflare for the cookieless analytics', () => {
    expect(cloudflareRow).toMatch(/analytics/i)
  })
})
