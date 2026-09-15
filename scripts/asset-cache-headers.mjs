/**
 * Cache policy for Astro's fingerprinted assets.
 *
 * Everything under _astro carries a hash of its contents in the filename, so
 * the URL changes whenever the bytes do. Such a file can be cached forever and
 * can never go stale. The host was serving them under the same 7 day policy as
 * everything else, which throws away the entire point of hashing them.
 *
 * A directory-scoped .htaccess rather than a pattern match in the site-wide
 * one, because "everything in this directory" is precisely the rule. Matching
 * hashed filenames with a regex from the parent would mean guessing at Astro's
 * naming scheme and re-guessing whenever it changes. It has to be written at
 * build time because _astro is generated output, so there is no source
 * directory to keep a file in.
 *
 * Deliberately NOT applied to /fonts/. Those filenames are stable
 * (ibm-plex-mono-400.woff2), so an immutable policy would pin a stale copy if
 * one were ever replaced. Fingerprinting is what earns the aggressive policy,
 * and stable names do not have it.
 */

export const IMMUTABLE_HTACCESS = `# Generated at build time. Do not edit here: the source is
# scripts/asset-cache-headers.mjs in the laravel-truss-docs repo.
#
# Every file in this directory is fingerprinted: its name contains a hash of its
# contents, so a change to the bytes produces a different URL. Nothing here can
# go stale, which is what makes a year plus immutable safe. immutable tells the
# browser not to revalidate even on a reload.
<IfModule mod_headers.c>
  Header set Cache-Control "public, max-age=31536000, immutable"
</IfModule>
`
