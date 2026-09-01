#!/usr/bin/env node
//
// Post-deploy redirect smoke check, run against production by hand.
//
//   npm run check:redirects
//   npm run check:redirects -- https://trussphp.com
//
// Nothing in tests/ can catch what this catches. Every assertion in
// tests/htaccess.test.js and tests/docroot-htaccess.test.js reads the .htaccess
// files as text, so they confirm a rule is present and can never confirm it
// works. Both redirect failures this site has had were invisible to them:
//
//   17/08/2026  a 301 added through cPanel landed below the docroot's catch-all
//               [L] rule and never fired once. Nothing reported an error.
//   28/08/2026  mod_dir built its DirectorySlash redirect from the internally
//               rewritten path, so every non-trailing-slash URL on the site
//               redirected through a client-visible /current/... URL.
//
// The second one survived a full round of verification because every URL that
// round tested already ended in a slash, which is the one shape that cannot
// trigger it. Hence the cases below.
//
// Exits non-zero on the first failure, so it can gate a deploy.

const base = (process.argv[2] || 'https://trussphp.com').replace(/\/$/, '')
const host = new URL(base).host

// A cache-busting query, because the host sits behind a CDN and a cached 200 is
// indistinguishable from a broken redirect. Fixed per run rather than random so
// a failure can be re-fetched by hand exactly as it was seen.
const nonce = `nc=${process.pid}`

const GOOGLEBOT =
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'

// Each case is: the request, and what must be true of the whole chain.
//
//   hops       exact number of redirects to the final response
//   status     final status code
//   endsAt     final URL, with the nonce stripped
//   noCurrent  no hop's Location may mention current/ or releases/ (always on)
const CASES = [
  // The bug this file exists for. One hop, straight to the canonical URL.
  { path: '/roadmap', hops: 1, status: 200, endsAt: `${base}/roadmap/` },
  { path: '/guides/theming', hops: 1, status: 200, endsAt: `${base}/guides/theming/` },
  { path: '/in-the-wild', hops: 1, status: 200, endsAt: `${base}/in-the-wild/` },
  { path: '/demo', hops: 1, status: 200, endsAt: `${base}/demo/` },

  // Host normalisation is owned by the docroot .htaccess, which runs before the
  // rewrite into current/. Two hops is the floor for a non-canonical host on a
  // non-slashed path: one to fix the host, one to add the slash. They cannot be
  // collapsed, because the two rules live in different files by necessity.
  { url: `http://www.${host}/roadmap`, hops: 2, status: 200, endsAt: `${base}/roadmap/` },
  { url: `http://www.${host}/roadmap/`, hops: 1, status: 200, endsAt: `${base}/roadmap/` },
  { url: `https://www.${host}/`, hops: 1, status: 200, endsAt: `${base}/` },
  { url: `http://${host}/`, hops: 1, status: 200, endsAt: `${base}/` },

  // The deploy plumbing, reached directly. Must never serve, and must never
  // appear in a Location header on the way out.
  { path: '/current/roadmap/', hops: 1, status: 200, endsAt: `${base}/roadmap/` },
  { path: '/current/roadmap', hops: 2, status: 200, endsAt: `${base}/roadmap/` },

  // Already canonical: no redirect at all, and no second slash on the root.
  { path: '/', hops: 0, status: 200, endsAt: `${base}/` },
  { path: '/roadmap/', hops: 0, status: 200, endsAt: `${base}/roadmap/` },

  // A static file is not a directory, so the -d guard must leave it alone.
  { path: '/favicon.svg', hops: 0, status: 200, endsAt: `${base}/favicon.svg` },

  // index.html folds to its directory, and the query string survives the hop.
  { path: '/demo/index.html', hops: 1, status: 200, endsAt: `${base}/demo/` },
]

// /releases/ is asserted separately: it is the one case that must NOT resolve.
const FORBIDDEN = { path: '/releases/', status: 403 }

const withNonce = (url) => url + (url.includes('?') ? '&' : '?') + nonce
const stripNonce = (url) =>
  url.replace(new RegExp(`[?&]${nonce}$`), '').replace(new RegExp(`&${nonce}`), '')

async function chase(startUrl, { maxHops = 10 } = {}) {
  const locations = []
  let url = withNonce(startUrl)
  let status = 0

  for (let i = 0; i <= maxHops; i++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': GOOGLEBOT },
    })
    status = res.status
    const location = res.headers.get('location')
    if (!location || status < 300 || status >= 400) break
    // Resolve against the current URL so a relative Location is handled.
    url = new URL(location, url).toString()
    locations.push(url)
    if (i === maxHops) throw new Error(`more than ${maxHops} redirects`)
  }

  return { hops: locations.length, status, locations, finalUrl: stripNonce(url) }
}

function problemsWith(expected, actual) {
  const problems = []

  // Always checked, for every case: the deploy plumbing must never be visible.
  for (const location of actual.locations) {
    if (/\/(current|releases)(\/|$|\?)/.test(location)) {
      problems.push(`leaks the internal deploy path: ${stripNonce(location)}`)
    }
  }

  if (expected.hops !== undefined && actual.hops !== expected.hops) {
    problems.push(`${actual.hops} hop(s), expected ${expected.hops}`)
  }
  if (expected.status !== undefined && actual.status !== expected.status) {
    problems.push(`final status ${actual.status}, expected ${expected.status}`)
  }
  if (expected.endsAt !== undefined && actual.finalUrl !== expected.endsAt) {
    problems.push(`ended at ${actual.finalUrl}, expected ${expected.endsAt}`)
  }
  if (/\/\/$/.test(actual.finalUrl.replace(/^https?:\/\//, ''))) {
    problems.push(`final URL has a double slash: ${actual.finalUrl}`)
  }

  return problems
}

let failures = 0

for (const c of [...CASES, FORBIDDEN]) {
  const target = c.url || `${base}${c.path}`
  let actual
  try {
    actual = await chase(target)
  } catch (e) {
    console.log(`FAIL  ${target}\n        ${e.message}`)
    failures++
    continue
  }

  const problems = problemsWith(c, actual)
  if (problems.length === 0) {
    const via = actual.hops ? ` (${actual.hops} hop${actual.hops > 1 ? 's' : ''})` : ''
    console.log(`ok    ${target}${via}`)
  } else {
    failures++
    console.log(`FAIL  ${target}`)
    for (const p of problems) console.log(`        ${p}`)
    for (const l of actual.locations) console.log(`        via ${stripNonce(l)}`)
  }
}

console.log(
  failures === 0
    ? `\nAll ${CASES.length + 1} redirect cases passed against ${base}.`
    : `\n${failures} of ${CASES.length + 1} cases failed against ${base}. Revert before walking away.`,
)

process.exit(failures === 0 ? 0 : 1)
