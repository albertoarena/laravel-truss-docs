/**
 * Ask the live site the only question that gates the AEO work: can a client that
 * cannot run JavaScript read it?
 *
 * Run against production:
 *   npm run check:machine-access
 *   npm run check:machine-access -- https://staging.example.com
 *
 * Deliberately NOT part of `npm test`. It talks to the network, so it would make
 * the suite non-deterministic and would fail offline. The pure parts it relies
 * on are unit-tested in tests/machine-access.test.js.
 *
 * Be careful about adding targets or agents. This is a polite checker on purpose:
 * a small cross of requests, spaced out. The first version fired 35 requests back
 * to back and tripped the origin's rate limiting, so it reported 429s it had
 * caused itself. A checker that changes what it measures is worse than none.
 *
 * Exits non-zero when an answer-time agent cannot read the site. The known
 * host-blocked training crawlers are reported but never fail the run: that block
 * is disclosed in robots.txt rather than fought.
 */

import {
  ANSWER_ENGINE_AGENTS,
  KNOWN_BLOCKED_AGENTS,
  buildChecks,
  checkUrl,
} from './machine-access.mjs'

const base = (process.argv[2] || process.env.SITE_URL || 'https://trussphp.com').replace(/\/$/, '')
const delayMs = Number(process.env.CHECK_DELAY_MS ?? 1500)

/** One representative of each shape the site serves. The first is the primary. */
const TARGETS = [
  { path: '/', label: 'landing' },
  { path: '/getting-started/installation/', label: 'docs page' },
  { path: '/robots.txt', label: 'robots.txt' },
  { path: '/sitemap-index.xml', label: 'sitemap', expect: 'xml' },
]

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const tick = (ok) => (ok ? '  ok  ' : ' FAIL ')
const row = (mark, agent, label, status, note) =>
  `${mark} ${agent.padEnd(18)} ${label.padEnd(14)} ${String(status || 'ERR').padEnd(4)} ${note}`

async function run() {
  console.log(`\nMachine access check against ${base}`)
  console.log(`(${delayMs}ms between requests, so the checker does not rate-limit itself)\n`)

  console.log('Answer-time agents (these decide whether the site can be cited)\n')
  const results = []
  for (const check of buildChecks({ base, agents: ANSWER_ENGINE_AGENTS, targets: TARGETS })) {
    const result = await checkUrl(check.url, { userAgent: check.userAgent, expect: check.expect })
    results.push(result)
    console.log(row(tick(result.readable), check.userAgent, check.label, result.status, result.reason))
    await pause(delayMs)
  }

  // Informational: the host-level block. Reported so that if it ever lifts, the
  // disclosure in robots.txt can be dropped instead of quietly going stale.
  console.log('\nTraining crawlers blocked by the host (informational, never fatal)\n')
  for (const agent of KNOWN_BLOCKED_AGENTS) {
    const result = await checkUrl(`${base}/`, { userAgent: agent })
    const note = result.readable ? 'now passing, the robots.txt disclosure is stale' : result.reason
    console.log(row('  --  ', agent, 'landing', result.status, note))
    await pause(delayMs)
  }

  const failures = results.filter((result) => !result.readable)

  if (failures.length === 0) {
    console.log(`\nAll ${results.length} checks passed. The site is machine readable.\n`)
    return 0
  }

  console.log(`\n${failures.length} of ${results.length} checks failed.`)
  if (failures.some((failure) => failure.reason === 'challenge')) {
    console.log(
      'A "challenge" reason means a bot interstitial is served instead of content.\n' +
        'See .docs/plans/aeo-geo-readiness.md, Task 0: a hosting change, not a code fix.',
    )
  }
  if (failures.some((failure) => failure.reason === 'http-429')) {
    console.log(
      'A 429 usually means this checker, or something else from this IP, has been\n' +
        'making too many requests. Wait a few minutes and re-run before believing it.',
    )
  }
  console.log('')
  return 1
}

process.exitCode = await run()
