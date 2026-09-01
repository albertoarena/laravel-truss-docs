import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// deploy/docroot.htaccess is a reference copy of the .htaccess that sits in the
// document root on the host, one level above releases/. That file is applied by
// hand and is not deployed by CI, so this copy is documentation, not a
// deliverable. It is tracked because the live file went unreviewed for long
// enough to carry a redirect that never once fired.
//
// The rule that matters is ordering. The docroot rewrites every request into
// current/ with [L], so any redirect written below that line is unreachable.
// A 301 added through cPanel's Redirects UI landed there on 17/08/2026 and was
// measured dead: /releases/ still returned 403 and the site still served, so
// the file was being read, but http://www.trussphp.com/ kept returning 200
// despite matching every condition on the rule.

const repo = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))

describe('the docroot .htaccess reference copy', () => {
  let htaccess = ''

  beforeAll(() => {
    const path = repo('deploy/docroot.htaccess')
    if (!existsSync(path)) {
      throw new Error(
        'deploy/docroot.htaccess missing. It is the only tracked record of the hand-applied docroot rules, including the ordering constraint that keeps the canonical host redirect alive.',
      )
    }
    htaccess = readFileSync(path, 'utf8')
  })

  it('still denies direct access to the release directories', () => {
    expect(htaccess).toMatch(/RewriteRule\s+\^releases\(\/\.\*\)\?\$\s+-\s+\[F,L\]/)
  })

  it('still rewrites into current/, guarded against looping', () => {
    expect(htaccess).toContain('RewriteCond %{REQUEST_URI} !^/current/')
    expect(htaccess).toContain('RewriteRule ^(.*)$ current/$1 [L]')
  })

  it('normalises host and scheme before the rewrite into current/', () => {
    // The whole point. current/ matches everything and ends with [L], so a
    // redirect placed after it can never run.
    const normalise = htaccess.indexOf('https://trussphp.com/$1')
    const current = htaccess.indexOf('RewriteRule ^(.*)$ current/$1 [L]')

    expect(normalise).toBeGreaterThan(-1)
    expect(current).toBeGreaterThan(-1)
    expect(normalise).toBeLessThan(current)
  })

  it('forces https while keeping the proxy guards', () => {
    // Without these, a TLS-terminating proxy that speaks plain http to the
    // origin would see every request as insecure and redirect it forever.
    expect(htaccess).toContain('RewriteCond %{HTTPS} off')
    expect(htaccess).toContain('RewriteCond %{HTTP:X-Forwarded-SSL} !on')
    expect(htaccess).toContain('RewriteCond %{HTTP:X-Forwarded-Proto} !https')
  })

  it('folds www into the apex over https too', () => {
    // The rule this replaces only covered http AND www together, so
    // https://www.trussphp.com, the commonest duplicate, was never handled.
    expect(htaccess).toContain('RewriteCond %{HTTP_HOST} ^www\\.trussphp\\.com$ [NC]')
  })

  it('carries two rules that both target the apex directly', () => {
    const rules = htaccess.match(/RewriteRule \^\(\.\*\)\$ https:\/\/trussphp\.com\/\$1 \[R=301,L\]/g)

    // Two rules, because mod_rewrite has no parentheses and an AND-group
    // cannot be nested inside an OR. Both target the apex rather than each
    // other, which is what stops http://www chaining through https://www.
    //
    // This assertion used to be named "sends every non-canonical host to the
    // apex in a single hop". It cannot know that: it counts two matches in a
    // text file. The claim was also false. On 28/08/2026
    // http://www.trussphp.com/roadmap measured three hops, because a path with
    // no trailing slash picks up a mod_dir redirect that no amount of reading
    // this file would reveal. Hop counts come from npm run check:redirects,
    // against production. Do not put a behavioural claim in a name here again.
    expect(rules).toHaveLength(2)
  })

  it('is not published with the site', () => {
    // It describes the server, not the build. Shipping it would put the
    // docroot's rules inside every release, where they would fire from the
    // wrong directory.
    expect(existsSync(repo('dist/deploy'))).toBe(false)
    expect(existsSync(repo('dist/docroot.htaccess'))).toBe(false)
  })
})
