/**
 * Can a client that cannot run JavaScript read this site?
 *
 * Everything else in the AEO work (structured data, llms.txt, ai.txt) assumes
 * the answer is yes. On 2026-08-15 it was no: every non-browser client got a
 * BitNinja "One moment, please..." interstitial instead of content, so an AI
 * answer engine could read nothing here. The cause was not the origin, which
 * serves the real page when hit directly, but the Cloudflare-proxied path: with
 * the orange cloud on, all traffic reaches the origin from a handful of edge IPs
 * with the real client address unread in CF-Connecting-IP, and the origin WAF
 * treats the whole edge as one abusive client.
 *
 * Browsers pass the check silently, which is why this was invisible for three
 * days. Hence a checker rather than a note.
 *
 * The classification below is pure and unit-tested. The live run lives in
 * check-machine-access.mjs and is deliberately not part of `npm test`, so the
 * suite stays offline and deterministic.
 */

/**
 * Agents that fetch a page to answer a question right now. These decide whether
 * the site can be cited, so all of them must be able to read it.
 */
export const ANSWER_ENGINE_AGENTS = [
  'Claude-User',
  'Claude-SearchBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Googlebot',
  'bingbot',
]

/**
 * Agents the hosting provider's WAF blocks account-wide, with a 403 that is not
 * ours to lift. All three are bulk training crawlers, so none of them affects
 * whether the site can be cited. The block is accepted and disclosed in
 * robots.txt rather than fought: see .docs/plans/aeo-geo-readiness.md.
 *
 * Checked and reported, never fatal. If one of these starts passing, the
 * disclosure in robots.txt has gone stale and should be dropped.
 */
export const KNOWN_BLOCKED_AGENTS = ['ClaudeBot', 'Amazonbot', 'Bytespider']

/**
 * Markers of the interstitial. Three independent ones, because a challenge page
 * that only changed its wording would otherwise slip through: the title, the
 * sentence shown to the visitor, and the parameter its hidden form posts.
 */
const CHALLENGE_MARKERS = [
  'One moment, please',
  'being verified',
  'wsidchk',
]

/** True if this response body is a bot challenge rather than real content. */
export function isChallenge(body) {
  if (!body) return false
  return CHALLENGE_MARKERS.some((marker) => body.includes(marker))
}

const looksLikeXml = (contentType, body) =>
  /xml/i.test(contentType ?? '') && /^\s*<\?xml|<urlset|<sitemapindex/i.test(body ?? '')

/**
 * Turn a response into a verdict.
 *
 * `expect: 'xml'` is checked before the challenge markers on purpose. When the
 * sitemap is answered with an HTML challenge page, the useful thing to report is
 * that it is not XML: that is the symptom someone will actually go looking for,
 * and a 200 with an HTML body is precisely how this failure hid from a plain
 * status check.
 */
export function classify({ status, contentType, body, expect: expected = 'html' }) {
  if (status >= 400) {
    return { readable: false, reason: `http-${status}` }
  }

  if (expected === 'xml' && !looksLikeXml(contentType, body)) {
    return { readable: false, reason: 'not-xml' }
  }

  if (isChallenge(body)) {
    return { readable: false, reason: 'challenge' }
  }

  return { readable: true, reason: 'ok' }
}

/**
 * The set of requests to make: a cross, not a full matrix.
 *
 * Every agent against the primary target answers "can this agent read the site",
 * and the primary agent against every target answers "is each URL shape served
 * correctly". A full matrix answers nothing more and costs agents x targets
 * requests. The first version of this checker did exactly that, sent 35 requests
 * back to back, and tripped the origin's rate limiting, so it ended up measuring
 * traffic it had generated itself. Keep it small, and keep it spaced (see the
 * delay in check-machine-access.mjs).
 */
export function buildChecks({ base, agents, targets }) {
  const [primaryAgent] = agents
  const [primaryTarget] = targets
  const url = (target) => `${base}${target.path}`

  const checks = agents.map((agent) => ({
    url: url(primaryTarget),
    userAgent: agent,
    label: primaryTarget.label,
    expect: primaryTarget.expect,
  }))

  for (const target of targets.slice(1)) {
    checks.push({
      url: url(target),
      userAgent: primaryAgent,
      label: target.label,
      expect: target.expect,
    })
  }

  return checks
}

/** The full header string, so the request looks like the agent it names. */
export const userAgentString = (agent) => `Mozilla/5.0 (compatible; ${agent}/1.0)`

/* -------------------------------------------------------------------------- */
/* Sampling                                                                    */
/*                                                                             */
/* One run cannot answer the question this site poses. On 2026-08-15 it failed  */
/* every check at 14:21 and passed every check at 16:45 with nothing changed,   */
/* so what matters is the rate and the shape, not a verdict. The sampler probes */
/* once every few minutes for hours and appends a record per probe; everything  */
/* below is pure, so the loop stays a thin wrapper and the analysis is testable */
/* and re-runnable over a partial file.                                         */
/* -------------------------------------------------------------------------- */

/** Cycle the agent per sample, so we keep testing the UA assumption. */
export const rotateAgent = (index, agents) => agents[index % agents.length]

/**
 * The Cloudflare colo that served a request, off the cf-ray header.
 *
 * Recorded on the chance that it varies. From a fixed location anycast will
 * almost always route to the same colo, so this is unlikely to discriminate;
 * what actually varies is which Cloudflare egress IP reaches the origin, and
 * that is invisible from here. Cheap enough to keep, and informative if it moves.
 */
export function colo(cfRay) {
  // A cf-ray is hex, a dash, then a three-letter airport code: a2b8d82e...-FCO.
  // Matching the shape rather than splitting on the last dash, so an arbitrary
  // hyphenated string does not get reported as a colo.
  const match = /^[0-9a-f]+-([a-z]{3})$/i.exec(cfRay ?? '')
  return match ? match[1].toUpperCase() : 'unknown'
}

/** One record, one line. Append-only, so an interrupted run loses nothing. */
export const serialiseSample = (record) => `${JSON.stringify(record)}\n`

/**
 * Read a sample file back.
 *
 * Blank and malformed lines are skipped rather than fatal: a half-written final
 * line is the normal result of stopping the sampler, and throwing away hours of
 * good samples over one truncated one would be absurd.
 */
export function parseSamples(jsonl) {
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
}

/**
 * Turn a run into an answer.
 *
 * `failureRateUpperBound` is the part that matters most. Zero failures never
 * means zero risk: by the rule of three, n clean samples put the 95% upper bound
 * on the true failure rate at about 3/n. Reporting that instead of "all good" is
 * the whole point, because "all good" from a single probe is exactly what made
 * this site look healthy while it was unreadable.
 */
export function summarise(samples) {
  const total = samples.length
  const readable = samples.filter((sample) => sample.readable).length
  const failures = samples.filter((sample) => !sample.readable)

  const reasons = {}
  for (const failure of failures) {
    reasons[failure.reason] = (reasons[failure.reason] ?? 0) + 1
  }

  let longestFailureStreak = 0
  let currentStreak = 0
  for (const sample of samples) {
    currentStreak = sample.readable ? 0 : currentStreak + 1
    longestFailureStreak = Math.max(longestFailureStreak, currentStreak)
  }

  const byColo = {}
  for (const sample of samples) {
    const key = sample.colo ?? 'unknown'
    byColo[key] ??= { total: 0, readable: 0 }
    byColo[key].total += 1
    if (sample.readable) byColo[key].readable += 1
  }

  return {
    total,
    readable,
    unreadable: failures.length,
    readableRate: total === 0 ? null : readable / total,
    reasons,
    longestFailureStreak,
    firstFailureAt: failures.length ? failures[0].at : null,
    lastFailureAt: failures.length ? failures[failures.length - 1].at : null,
    byColo,
    // Capped at certainty: below three samples 3/n exceeds 1, and printing a
    // "300% failure rate" helps nobody.
    failureRateUpperBound: total > 0 && failures.length === 0 ? Math.min(1, 3 / total) : null,
  }
}

/**
 * The rule of three, inverted: how many clean samples are needed before the
 * bound drops to `rate`. Printed next to a weak bound so a short run reports its
 * own inadequacy instead of looking like a pass.
 */
export const samplesNeededFor = (rate) => Math.ceil(3 / rate)

/**
 * Fetch one URL as one agent and return a verdict.
 *
 * A network failure is a verdict, not an exception: a host that times out is
 * exactly as unreadable as one that serves a challenge, and the caller is
 * checking many combinations and wants every row.
 */
export async function checkUrl(url, { userAgent, expect: expected = 'html', fetchImpl = fetch } = {}) {
  try {
    const response = await fetchImpl(url, {
      headers: { 'user-agent': userAgentString(userAgent) },
      redirect: 'follow',
    })
    const body = await response.text()
    const contentType = response.headers.get('content-type')
    const verdict = classify({ status: response.status, contentType, body, expect: expected })

    return {
      url,
      userAgent,
      status: response.status,
      contentType,
      colo: colo(response.headers.get('cf-ray')),
      ...verdict,
    }
  } catch (error) {
    return {
      url,
      userAgent,
      status: 0,
      contentType: null,
      colo: 'unknown',
      readable: false,
      reason: error.message,
    }
  }
}
