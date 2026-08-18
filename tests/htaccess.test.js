import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// The deploy publishes dist/ into releases/<timestamp>/ on the host and flips a
// `current` symlink at it. That plumbing was reachable from the web, so
// /current/ served the whole site a second time, splitting analytics and giving
// search engines a duplicate.
//
// The rules live in public/.htaccess, which ships inside every release, rather
// than in the docroot .htaccess, which is hand-maintained on the host and
// managed by cPanel's Redirects feature. Hand-added rules there have proven
// unreliable.
//
// These assertions exist mainly for one failure mode: if the build ever stops
// copying the dotfile into dist/, everything still deploys green and the paths
// quietly become public again.

const dist = (p) => fileURLToPath(new URL(`../dist/${p}`, import.meta.url))

describe('the deployed .htaccess', () => {
  let htaccess = ''

  beforeAll(() => {
    const path = dist('.htaccess')
    if (!existsSync(path)) {
      throw new Error(
        'dist/.htaccess missing. Either the build was not run, or public/.htaccess is no longer being copied, which would republish /current/ and /releases/.',
      )
    }
    htaccess = readFileSync(path, 'utf8')
  })

  it('is shipped in the built output', () => {
    expect(htaccess).not.toBe('')
  })

  it('turns the rewrite engine on', () => {
    expect(htaccess).toMatch(/RewriteEngine\s+On/i)
  })

  it('matches on the original request line, not the rewritten path', () => {
    // %{THE_REQUEST} is what the client actually asked for, so an internal
    // rewrite to current/ done at the docroot cannot trigger this rule. Matching
    // the rewritten path instead would redirect every normal page view.
    expect(htaccess).toMatch(/RewriteCond\s+%\{THE_REQUEST\}/)
  })

  it('covers both current/ and releases/', () => {
    expect(htaccess).toMatch(/\(current\|releases\)/)
  })

  it('redirects permanently and stops processing', () => {
    expect(htaccess).toMatch(/\[R=301,L\]/)
  })

  it('preserves the path below the prefix', () => {
    // Per-directory rewriting strips the matched prefix, so ^(.*)$ carries the
    // remainder: /current/guides/theming/ lands on /guides/theming/, not /.
    expect(htaccess).toMatch(/RewriteRule\s+\^\(\.\*\)\$/)
  })

  it('leaves host and scheme normalisation to the docroot file', () => {
    // Folding www and http into https://trussphp.com has to happen before the
    // docroot rewrites into current/, which this file cannot do from inside
    // current/. Putting a copy here as well would give one behaviour two
    // owners, and the docroot rule would always win anyway.
    expect(htaccess).not.toMatch(/RewriteRule[^\n]*https:\/\/trussphp\.com/)
  })

  it('redirects index.html to its directory', () => {
    // /demo/index.html and /demo/ served identical bytes at two URLs. The
    // canonical tag already resolved it, so this is tidiness rather than a
    // fix: one URL per page, and no crawler spending a fetch to be told so.
    expect(htaccess).toMatch(/RewriteRule\s+\^\(\.\*\/\)\?index\\\.html\$/)
  })

  it('matches the request line, so DirectoryIndex cannot loop it', () => {
    // /demo/ is served by internally resolving index.html. Matching the
    // rewritten path would therefore redirect /demo/ to /demo/ forever.
    // %{THE_REQUEST} holds what the client actually asked for, so only a
    // client that typed index.html is caught.
    const rule = htaccess.slice(htaccess.indexOf('index\\.html'))
    const guard = htaccess.lastIndexOf('%{THE_REQUEST}', htaccess.indexOf('index\\.html'))

    expect(guard).toBeGreaterThan(-1)
    expect(rule).toBeTruthy()
  })

  it('guards the header directives, so a host without mod_headers still serves', () => {
    // An unguarded Header directive is a 500 on a server that lacks the
    // module, which would take the whole site down rather than degrade.
    expect(htaccess).toMatch(/<IfModule mod_headers\.c>/)
  })

  it('stops browsers guessing content types', () => {
    expect(htaccess).toMatch(/Header always set X-Content-Type-Options "nosniff"/)
  })

  it('sends a referrer policy that survives cross-origin', () => {
    expect(htaccess).toMatch(/Header always set Referrer-Policy "strict-origin-when-cross-origin"/)
  })

  it('starts HSTS at a short max-age, with no preload and no subdomains', () => {
    // HSTS is close to irreversible: browsers honour it for the whole max-age
    // whatever the site later says. https was only forced on 2026-08-18, so
    // this begins at 5 minutes to prove nothing breaks. Raise it deliberately,
    // in its own change, once that is established. includeSubDomains and
    // preload are both absent on purpose; preload in particular is permanent.
    // Assert on the directive's value, not on the file. The words appear in
    // the comment above it explaining why they are absent, so a naive search
    // of the whole file would fail on its own documentation.
    const hsts = htaccess.match(/Header always set Strict-Transport-Security "([^"]*)"/)

    expect(hsts).toBeTruthy()
    expect(hsts[1]).toBe('max-age=300')
  })

  it('makes HTML revalidate rather than be cached on a guess', () => {
    // With no Cache-Control at all, browsers fall back to heuristic caching
    // derived from Last-Modified. On a site that redeploys on every merge,
    // that is how someone reads yesterday's docs with no way to explain it.
    // no-cache still allows a cheap 304, it just forbids serving blind.
    expect(htaccess).toMatch(/<FilesMatch "\\\.html\$">/)
    expect(htaccess).toMatch(/Header set Cache-Control "no-cache"/)
  })

  it('points the 404 at a path that exists from the docroot', () => {
    // ErrorDocument resolves against the docroot, not the directory holding the
    // .htaccess. The docroot has no 404.html of its own: it only exists inside
    // each release, reachable as /current/404.html. Getting this wrong fails
    // silently, and the host serves its own generic error page instead.
    expect(htaccess).toMatch(/ErrorDocument\s+404\s+\/current\/404\.html/)
  })

  it('ships the 404 page the ErrorDocument points at', () => {
    expect(existsSync(dist('404.html'))).toBe(true)
    expect(readFileSync(dist('404.html'), 'utf8')).toMatch(/<title>[^<]*404/i)
  })
})
