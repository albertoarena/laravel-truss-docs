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
