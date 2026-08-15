import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ANSWER_ENGINE_AGENTS,
  KNOWN_BLOCKED_AGENTS,
  isChallenge,
  classify,
  checkUrl,
  buildChecks,
  rotateAgent,
  colo,
  summarise,
  serialiseSample,
  parseSamples,
  samplesNeededFor,
} from '../scripts/machine-access.mjs'

// Guards for the one thing that decides whether any of the AEO work matters:
// can a client that cannot run JavaScript read this site?
//
// Measured 2026-08-15, this site failed that test. Every non-browser client got
// a BitNinja "One moment, please..." interstitial instead of content, because
// with Cloudflare proxying on, the origin sees all traffic arriving from a
// handful of edge IPs and challenges it. Browsers pass the check silently, so
// the site looked perfectly healthy to a human while being unreadable to every
// answer engine. That is exactly the kind of failure that needs a test rather
// than a memory.
//
// What is unit-tested here is the classification, which is pure. The network
// call itself is a thin wrapper taking an injectable fetch, checked with a stub;
// the real live run is scripts/check-machine-access.mjs, deliberately kept out
// of `npm test` so the suite stays offline and deterministic.

const interstitial = readFileSync(
  fileURLToPath(new URL('./fixtures/bitninja-interstitial.html', import.meta.url)),
  'utf8',
)

const realPage = readFileSync(
  fileURLToPath(new URL('../dist/index.html', import.meta.url)),
  'utf8',
)

describe('isChallenge', () => {
  it('recognises the interstitial actually served to non-browser clients', () => {
    expect(isChallenge(interstitial)).toBe(true)
  })

  it('does not mistake this site’s own homepage for a challenge', () => {
    expect(isChallenge(realPage)).toBe(false)
  })

  it('keys on more than one marker, so a reworded challenge is still caught', () => {
    expect(isChallenge('<title>One moment, please...</title>')).toBe(true)
    expect(isChallenge('Please wait while your request is being verified...')).toBe(true)
    expect(isChallenge('<input name="wsidchk" value="123">')).toBe(true)
  })

  it('treats an empty or missing body as not a challenge, not as a crash', () => {
    expect(isChallenge('')).toBe(false)
    expect(isChallenge(undefined)).toBe(false)
  })
})

describe('classify', () => {
  it('accepts a real page served with a 200', () => {
    const result = classify({ status: 200, contentType: 'text/html', body: realPage })
    expect(result.readable).toBe(true)
  })

  it('rejects the interstitial even though it arrives with a 200', () => {
    const result = classify({ status: 200, contentType: 'text/html', body: interstitial })
    expect(result.readable).toBe(false)
    expect(result.reason).toBe('challenge')
  })

  it('rejects an outright block, naming the status', () => {
    const result = classify({ status: 403, contentType: 'text/html', body: 'Forbidden' })
    expect(result.readable).toBe(false)
    expect(result.reason).toBe('http-403')
  })

  it('accepts a sitemap that is really XML', () => {
    const result = classify({
      status: 200,
      contentType: 'application/xml',
      body: '<?xml version="1.0"?><urlset></urlset>',
      expect: 'xml',
    })
    expect(result.readable).toBe(true)
  })

  it('rejects a sitemap answered with HTML, which is how this failure hides', () => {
    // The live symptom on 2026-08-15: /sitemap-index.xml returned 200 with an
    // HTML body, so a naive status check called it healthy.
    const result = classify({
      status: 200,
      contentType: 'text/html',
      body: interstitial,
      expect: 'xml',
    })
    expect(result.readable).toBe(false)
    expect(result.reason).toBe('not-xml')
  })
})

describe('the agent lists', () => {
  it('requires every answer-time agent, the ones that decide AEO', () => {
    expect(ANSWER_ENGINE_AGENTS).toEqual(
      expect.arrayContaining(['Claude-User', 'Claude-SearchBot', 'OAI-SearchBot', 'PerplexityBot']),
    )
  })

  it('does not require the agents the host blocks account-wide', () => {
    // ClaudeBot, Amazonbot and Bytespider get a host-level 403 that is not ours
    // to lift. That block is accepted and disclosed in robots.txt rather than
    // fought, so it must not fail this check. See .docs/plans/aeo-geo-readiness.md.
    for (const blocked of KNOWN_BLOCKED_AGENTS) {
      expect(ANSWER_ENGINE_AGENTS).not.toContain(blocked)
    }
    expect(KNOWN_BLOCKED_AGENTS).toContain('ClaudeBot')
  })
})

describe('buildChecks', () => {
  // The first version of this checked every agent against every target: 7 x 5 =
  // 35 rapid requests, which tripped the origin's rate limiting and returned
  // 429s. The checker was measuring its own noise. A cross rather than a full
  // matrix covers the same two questions (can each agent read the site, and is
  // each URL shape served correctly) at a fraction of the traffic.
  const agents = ['Claude-User', 'OAI-SearchBot', 'PerplexityBot']
  const targets = [
    { path: '/', label: 'landing' },
    { path: '/docs/', label: 'docs page' },
    { path: '/sitemap-index.xml', label: 'sitemap', expect: 'xml' },
  ]
  const checks = buildChecks({ base: 'https://example.com', agents, targets })

  it('is a cross, not a full matrix, so it cannot rate-limit itself', () => {
    expect(checks).toHaveLength(agents.length + targets.length - 1)
  })

  it('tries every agent against the primary target', () => {
    const onLanding = checks.filter((check) => check.url === 'https://example.com/')
    expect(onLanding.map((check) => check.userAgent).sort()).toEqual([...agents].sort())
  })

  it('tries every target shape at least once', () => {
    const urls = new Set(checks.map((check) => check.url))
    for (const target of targets) {
      expect(urls).toContain(`https://example.com${target.path}`)
    }
  })

  it('carries the expected content type through, so the sitemap is checked as XML', () => {
    const sitemap = checks.find((check) => check.url.endsWith('sitemap-index.xml'))
    expect(sitemap.expect).toBe('xml')
  })

  it('emits no duplicate agent and url pairs', () => {
    const pairs = checks.map((check) => `${check.userAgent} ${check.url}`)
    expect(new Set(pairs).size).toBe(pairs.length)
  })
})

describe('checkUrl', () => {
  const stub = (status, body, headers = { 'content-type': 'text/html' }) => {
    const calls = []
    const impl = async (url, init) => {
      calls.push({ url, init })
      return {
        status,
        headers: { get: (name) => headers[name.toLowerCase()] ?? null },
        text: async () => body,
      }
    }
    impl.calls = calls
    return impl
  }

  it('sends the agent it was asked to impersonate', async () => {
    const fetchImpl = stub(200, realPage)
    await checkUrl('https://trussphp.com/', { userAgent: 'OAI-SearchBot', fetchImpl })

    expect(fetchImpl.calls).toHaveLength(1)
    expect(fetchImpl.calls[0].init.headers['user-agent']).toContain('OAI-SearchBot')
  })

  it('reports the verdict alongside the url and agent that produced it', async () => {
    const fetchImpl = stub(200, interstitial)
    const result = await checkUrl('https://trussphp.com/', { userAgent: 'GPTBot', fetchImpl })

    expect(result).toMatchObject({
      url: 'https://trussphp.com/',
      userAgent: 'GPTBot',
      status: 200,
      readable: false,
      reason: 'challenge',
    })
  })

  it('records the Cloudflare colo that served it, for the sampler', async () => {
    const fetchImpl = stub(200, realPage, {
      'content-type': 'text/html',
      'cf-ray': 'a2b8d82e9a40ea63-FCO',
    })
    const result = await checkUrl('https://trussphp.com/', { userAgent: 'GPTBot', fetchImpl })

    expect(result.colo).toBe('FCO')
  })

  it('turns a network failure into a verdict rather than throwing', async () => {
    const fetchImpl = async () => {
      throw new Error('connect ETIMEDOUT')
    }
    const result = await checkUrl('https://trussphp.com/', { userAgent: 'GPTBot', fetchImpl })

    expect(result.readable).toBe(false)
    expect(result.reason).toContain('ETIMEDOUT')
  })
})

// Sampling mode.
//
// A single run cannot answer the question this site poses. On 2026-08-15 it
// failed every check at 14:21 and passed every check at 16:45, with nothing
// changed in between, so the fault is intermittent and what matters is the rate
// and the shape, not one verdict. The sampler appends one record per probe; the
// summary below is a pure function over those records, so the long-running loop
// stays a thin wrapper and this stays deterministic.

describe('rotateAgent', () => {
  const agents = ['a', 'b', 'c']

  it('cycles so consecutive samples do not all use one agent', () => {
    expect([0, 1, 2, 3, 4].map((i) => rotateAgent(i, agents))).toEqual(['a', 'b', 'c', 'a', 'b'])
  })
})

describe('colo', () => {
  it('reads the Cloudflare colo off a cf-ray header', () => {
    expect(colo('a2b8d82e9a40ea63-FCO')).toBe('FCO')
  })

  it('is unknown rather than a crash when the header is absent', () => {
    expect(colo(null)).toBe('unknown')
    expect(colo('')).toBe('unknown')
    expect(colo('no-dash-here')).toBe('unknown')
  })
})

describe('sample serialisation', () => {
  it('round-trips a record through JSONL', () => {
    const record = {
      at: '2026-08-15T14:21:00.000Z',
      userAgent: 'Claude-User',
      url: 'https://trussphp.com/',
      status: 200,
      readable: true,
      reason: 'ok',
      colo: 'FCO',
    }
    expect(parseSamples(serialiseSample(record))).toEqual([record])
  })

  it('skips blank and malformed lines rather than throwing away the run', () => {
    // A partially written final line is normal if the process is interrupted.
    const jsonl = '{"at":"2026-08-15T14:21:00.000Z","readable":true}\n\n{"at":"2026-'
    const samples = parseSamples(jsonl)
    expect(samples).toHaveLength(1)
    expect(samples[0].readable).toBe(true)
  })
})

describe('summarise', () => {
  const sample = (at, readable, reason = readable ? 'ok' : 'challenge', c = 'FCO') => ({
    at,
    userAgent: 'Claude-User',
    url: 'https://trussphp.com/',
    status: readable ? 200 : 200,
    readable,
    reason,
    colo: c,
  })

  it('reports the readable rate over the whole run', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', true),
      sample('2026-08-15T14:05:00.000Z', false),
      sample('2026-08-15T14:10:00.000Z', true),
      sample('2026-08-15T14:15:00.000Z', true),
    ])
    expect(result.total).toBe(4)
    expect(result.readable).toBe(3)
    expect(result.readableRate).toBeCloseTo(0.75)
  })

  it('breaks failures down by reason, so a challenge is not confused with a 429', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', false, 'challenge'),
      sample('2026-08-15T14:05:00.000Z', false, 'challenge'),
      sample('2026-08-15T14:10:00.000Z', false, 'http-429'),
    ])
    expect(result.reasons).toEqual({ challenge: 2, 'http-429': 1 })
  })

  it('measures the longest unbroken run of failures, which separates clustered from scattered', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', false),
      sample('2026-08-15T14:05:00.000Z', false),
      sample('2026-08-15T14:10:00.000Z', false),
      sample('2026-08-15T14:15:00.000Z', true),
      sample('2026-08-15T14:20:00.000Z', false),
    ])
    expect(result.longestFailureStreak).toBe(3)
  })

  it('names the window failures fell in', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', true),
      sample('2026-08-15T14:05:00.000Z', false),
      sample('2026-08-15T14:30:00.000Z', false),
      sample('2026-08-15T14:35:00.000Z', true),
    ])
    expect(result.firstFailureAt).toBe('2026-08-15T14:05:00.000Z')
    expect(result.lastFailureAt).toBe('2026-08-15T14:30:00.000Z')
  })

  it('groups by colo, in case the edge that served us turns out to matter', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', true, 'ok', 'FCO'),
      sample('2026-08-15T14:05:00.000Z', false, 'challenge', 'FCO'),
      sample('2026-08-15T14:10:00.000Z', true, 'ok', 'MXP'),
    ])
    expect(result.byColo).toEqual({
      FCO: { total: 2, readable: 1 },
      MXP: { total: 1, readable: 1 },
    })
  })

  it('bounds the failure rate by the rule of three when nothing failed', () => {
    // Zero failures never means zero risk. With n clean samples the 95% upper
    // bound on the true failure rate is about 3/n, and saying so is the whole
    // point: "all good" is the claim that misled us in the first place.
    const clean = Array.from({ length: 72 }, (_, i) =>
      sample(new Date(Date.UTC(2026, 7, 15, 14, i)).toISOString(), true),
    )
    const result = summarise(clean)
    expect(result.readableRate).toBe(1)
    expect(result.failureRateUpperBound).toBeCloseTo(3 / 72, 5)
  })

  it('never reports a bound above certainty, however few samples there are', () => {
    // 3/n exceeds 1 below three samples. A "300% failure rate" is not a useful
    // thing to print at anyone.
    const result = summarise([sample('2026-08-15T14:00:00.000Z', true)])
    expect(result.failureRateUpperBound).toBe(1)
  })

  it('does not claim a bound once something has actually failed', () => {
    const result = summarise([
      sample('2026-08-15T14:00:00.000Z', true),
      sample('2026-08-15T14:05:00.000Z', false),
    ])
    expect(result.failureRateUpperBound).toBeNull()
  })

  it('survives an empty run instead of dividing by zero', () => {
    const result = summarise([])
    expect(result.total).toBe(0)
    expect(result.readableRate).toBeNull()
    expect(result.longestFailureStreak).toBe(0)
  })
})

describe('samplesNeededFor', () => {
  // The useful inverse of the rule of three: how long must this run before a
  // clean result means anything? Printed alongside a weak bound so a short run
  // reports its own inadequacy rather than looking like a pass.
  it('inverts the rule of three', () => {
    expect(samplesNeededFor(0.05)).toBe(60)
    expect(samplesNeededFor(0.01)).toBe(300)
  })

  it('rounds up, since a partial sample does not exist', () => {
    expect(samplesNeededFor(0.04)).toBe(75)
    expect(samplesNeededFor(0.07)).toBe(43)
  })
})
