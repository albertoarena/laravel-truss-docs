// Copies the package's *shipped* frontend (the ES modules, truss.css, the
// vendored Mermaid, and the IBM Plex Mono fonts) into the docs site's static
// demo folder, so the live demo at /demo/ runs the exact same code that ships,
// with no drift. Runs automatically via the `prebuild`/`predev` npm hooks.
//
// This docs site lives in its own repo, so the frontend is fetched from the
// (public) package repo via a shallow, blobless, sparse clone of resources/,
// pinned to the latest package release tag. Override the ref with PACKAGE_REF
// (e.g. PACKAGE_REF=main for the latest dev frontend). Pinning to the release
// keeps the demo showing exactly what a released `composer require` ships.
//
// Everything lands flat in public/demo/assets/ because truss.css references its
// fonts as siblings (url("ibm-plex-mono-400.woff2")) and truss.js imports its
// modules as siblings (./selection.js). The folder is generated, not committed.
import { cp, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO = 'https://github.com/albertoarena/laravel-truss';
const API_LATEST = 'https://api.github.com/repos/albertoarena/laravel-truss/releases/latest';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const pkgDir = join(root, '_pkg');
const dest = join(root, 'public', 'demo', 'assets');

async function resolveRef() {
  if (process.env.PACKAGE_REF) return process.env.PACKAGE_REF;
  const headers = { 'User-Agent': 'laravel-truss-docs-build', Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(API_LATEST, { headers });
  if (!res.ok) {
    throw new Error(`Cannot resolve latest package release (HTTP ${res.status}). Set PACKAGE_REF to override.`);
  }
  const { tag_name: tag } = await res.json();
  if (!tag) throw new Error('Latest release has no tag_name.');
  return tag;
}

const ref = await resolveRef();
console.log(`Fetching Truss frontend from ${REPO} @ ${ref}`);

// Shallow, blobless, sparse clone of just resources/ at the chosen ref.
await rm(pkgDir, { recursive: true, force: true });
execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ref, REPO, pkgDir], { stdio: 'inherit' });
execFileSync('git', ['-C', pkgDir, 'sparse-checkout', 'set', 'resources'], { stdio: 'inherit' });

const resources = join(pkgDir, 'resources');
await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

// ES modules + vendor/mermaid.min.js (contents of resources/js land in assets/).
await cp(join(resources, 'js'), dest, { recursive: true });

// Stylesheet next to its fonts, so the relative @font-face urls resolve.
await cp(join(resources, 'css', 'truss.css'), join(dest, 'truss.css'));
for (const weight of ['400', '500', '600']) {
  const font = `ibm-plex-mono-${weight}.woff2`;
  await cp(join(resources, 'fonts', font), join(dest, font));
}

// Record the resolved ref so the build hook can version-stamp the demo asset
// folder for cache-busting (see astro.config.mjs → demoAssetVersioning).
await writeFile(join(root, '.demo-asset-version'), `${ref}\n`);

console.log(`Copied Truss frontend (${ref}) into ${dest}`);
