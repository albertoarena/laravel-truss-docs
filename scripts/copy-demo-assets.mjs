// Copies the package's *shipped* frontend (the ES modules, truss.css, the
// vendored Mermaid, and the IBM Plex Mono fonts) into the docs site's static
// demo folder, so the live demo at /demo/ runs the exact same code that ships,
// with no drift. Runs automatically via the `prebuild`/`predev` npm hooks.
//
// This docs site lives in its own repo, so the frontend is normally fetched from
// the (public) package repo via a shallow, blobless, sparse clone of resources/,
// pinned to the latest package release tag. Pinning to the release keeps the
// demo showing exactly what a released `composer require` ships.
//
// Two overrides, both for review rather than for deploying:
//
//   PACKAGE_REF=main          clone a different ref instead of the latest release
//   PACKAGE_PATH=../truss     copy from a local checkout, no clone at all
//
// PACKAGE_PATH exists because a package frontend change could not be seen in the
// demo until it had been pushed AND released. Reviewing one meant pushing a
// branch to aim PACKAGE_REF at, or hand-copying files into the built output and
// remembering that the next build would wipe them. A local build is stamped
// `local` rather than a version, so its asset folder is assets-local and a build
// made this way can never be mistaken for a release in the output.
//
// Everything lands flat in public/demo/assets/ because truss.css references its
// fonts as siblings (url("ibm-plex-mono-400.woff2")) and truss.js imports its
// modules as siblings (./selection.js). The folder is generated, not committed.
import { cp, rm, mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const REPO = 'https://github.com/albertoarena/laravel-truss';
const API_LATEST = 'https://api.github.com/repos/albertoarena/laravel-truss/releases/latest';

/** The version stamp a local build wears, in place of a release tag. */
export const LOCAL_STAMP = 'local';

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Where to take the frontend from, given the environment.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {{ kind: 'local', path: string } | { kind: 'release', ref: string|null }}
 *   `ref` null means "resolve the latest release", which needs the network and
 *   so is left to the caller.
 */
export function resolveSource(env = {}) {
  const path = trimmed(env.PACKAGE_PATH);
  if (path) return { kind: 'local', path };

  return { kind: 'release', ref: trimmed(env.PACKAGE_REF) || null };
}

async function resolveLatestRelease() {
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

/**
 * The resources/ directory to copy from, and the stamp naming this build.
 * Clones into `pkgDir` when the source is a release.
 */
async function prepareSource(source, pkgDir) {
  if (source.kind === 'local') {
    const checkout = resolve(source.path);
    const resources = join(checkout, 'resources');

    try {
      await access(join(resources, 'js', 'truss.js'));
    } catch {
      throw new Error(
        `PACKAGE_PATH=${source.path} does not look like a laravel-truss checkout: `
        + `expected ${join(resources, 'js', 'truss.js')}.`,
      );
    }

    console.log(`Copying Truss frontend from the local checkout at ${checkout}`);
    console.log('This build is stamped "local". Do not deploy it: it is not a released frontend.');

    return { resources, stamp: LOCAL_STAMP };
  }

  const ref = source.ref ?? (await resolveLatestRelease());
  console.log(`Fetching Truss frontend from ${REPO} @ ${ref}`);

  // Shallow, blobless, sparse clone of just resources/ at the chosen ref.
  await rm(pkgDir, { recursive: true, force: true });
  execFileSync('git', ['clone', '--depth', '1', '--filter=blob:none', '--sparse', '--branch', ref, REPO, pkgDir], { stdio: 'inherit' });
  execFileSync('git', ['-C', pkgDir, 'sparse-checkout', 'set', 'resources'], { stdio: 'inherit' });

  return { resources: join(pkgDir, 'resources'), stamp: ref };
}

async function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const pkgDir = join(root, '_pkg');
  const dest = join(root, 'public', 'demo', 'assets');

  const { resources, stamp } = await prepareSource(resolveSource(process.env), pkgDir);

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

  // Record the resolved stamp so the build hook can version-stamp the demo asset
  // folder for cache-busting (see astro.config.mjs → demoAssetVersioning).
  await writeFile(join(root, '.demo-asset-version'), `${stamp}\n`);

  console.log(`Copied Truss frontend (${stamp}) into ${dest}`);
}

// Only when run as a script. Importing this module (the tests do) must not clone
// a repository or touch the build output.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
