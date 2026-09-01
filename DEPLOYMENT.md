# Deployment

`trussphp.com` deploys with a **server-pull** model: CI never connects to the
host. CI publishes the built site to a branch, and the server pulls it over
HTTPS. This avoids inbound-SSH/FTP flakiness, and each pull is a clean release
(no stale-file buildup, rollback is a symlink flip).

## Pipeline

```
push to `main`
      │
      ▼
CI (.github/workflows/publish.yml): build → force-push static site to `deploy` branch
      │
      ▼
`deploy` branch = the built dist/ (static assets only, no source)
      │
      ▼  every ~5 min, cron on the host
scripts/server-deploy.sh: git fetch `deploy` over HTTPS
      │
      ▼
~/<docroot>/releases/<timestamp>/  (fresh)  +  current -> releases/<timestamp>  (atomic)
      │
      ▼
Apache serves through ~/<docroot>/.htaccess (rewrites all traffic to current/)
```

**Normal deploy: just push to `main`.** The site updates within ~5 minutes, no
manual step.

## Components

| Piece | Location |
|---|---|
| Build + publish | `.github/workflows/publish.yml` (push to `main` + manual dispatch) |
| Built output | `deploy` branch (force-pushed each build) |
| Server pull script | `scripts/server-deploy.sh` (source of truth in this repo) |
| Running copy on host | `~/bin/server-deploy.sh` (fetched from this repo) |
| Cron (host) | `*/5 * * * * /bin/bash $HOME/bin/server-deploy.sh >> $HOME/server-deploy.log 2>&1` |
| Docroot | `~/<docroot>/` with an `.htaccess` that normalises the host, then rewrites all traffic to `current/`. Applied by hand; tracked copy in `deploy/docroot.htaccess` |
| Releases + symlink | `~/<docroot>/releases/<ts>/`, `~/<docroot>/current` |

The `<docroot>` folder name is the deploy target (an addon-domain docroot).
The live demo's frontend is fetched at build time from the package repo
`albertoarena/laravel-truss` (`resources/`), pinned to the latest package
release; override with `PACKAGE_REF` (see `scripts/copy-demo-assets.mjs`).
`PACKAGE_PATH=../laravel-truss` builds against a local checkout for review; such
a build is stamped `local` and must never be deployed.

## Operations

**Deploy immediately (skip the cron wait)** — on the host:
```
bash ~/bin/server-deploy.sh
```
If CI hasn't published yet, run Actions → **Publish** → Run workflow first.

**Update the server script** — edit `scripts/server-deploy.sh`, commit, then on
the host:
```
curl -fsSL https://raw.githubusercontent.com/albertoarena/laravel-truss-docs/main/scripts/server-deploy.sh -o ~/bin/server-deploy.sh
chmod +x ~/bin/server-deploy.sh
```

**Rollback** — point `current` at a previous release (pause the cron to hold it,
otherwise the next run rolls forward to the latest `deploy` commit):
```
ls -1t ~/<docroot>/releases
ln -sfn releases/<previous-ts> ~/<docroot>/current
```

**Manual full deploy (fallback if CI is down)** — build locally
(`npm ci && npm run build`), upload `dist/` into a new
`~/<docroot>/releases/<ts>/`, and repoint `current`.

## Post-deploy checks

**After any change to `public/.htaccess` or the docroot `.htaccess`:**

```
npm run check:redirects
```

15 cases. It asserts hop counts, final URLs, and on every hop of every case that
neither `/current/` nor `/releases/` reaches a `Location` header. Exits non-zero
on the first problem, so it can gate a deploy. It takes a base URL as an
argument if you need to point it somewhere else.

**Wait for the release to land first.** The cron pulls every ~5 minutes, so a
green run against the previous release means nothing. Either wait, or force it
on the host with `bash ~/bin/server-deploy.sh`.

**Nothing in `tests/` can replace this.** Every assertion over the `.htaccess`
files reads them as text, so they confirm a rule is present and never that it
works. Both redirect failures this site has had were invisible that way:

- **17/08/2026** a 301 added through cPanel landed below the docroot's catch-all
  `[L]` rule and never fired once. Nothing reported an error.
- **28/08/2026** `mod_dir` built its redirect from the internally rewritten path,
  so every URL without a trailing slash went through a client-visible
  `/current/...` URL. This one survived a full round of verification, because
  every URL that round tested already ended in a slash, which is the one shape
  that cannot trigger it.

**If it fails, roll back before walking away.** `public/.htaccess` ships *inside*
each release, so the symlink flip under Rollback above reverts it in seconds and
beats reverting the commit and waiting for CI plus the cron. Pause the cron
first, or the next run rolls forward into the broken release again. Then revert
on `main` properly.

## Troubleshooting

- Log: `tail -n 50 ~/server-deploy.log`
- Run by hand: `bash ~/bin/server-deploy.sh` → `deployed release <ts> …` or
  `up to date (<sha>)`.
- `up to date` means the `deploy` branch has no new commit; check the Publish
  workflow ran green.
- `git: command not found` in cron is a PATH issue; the script prepends the
  host's git path. Adjust the `export PATH=...` line if git lives elsewhere.
- Verify live: `curl -s "https://trussphp.com/?nc=1" | grep -c cf-beacon`
  (expect 1); a `?nc=<random>` query bypasses the host CDN cache.

## Notes

- The server-pull needs **no secrets** (public repo, outbound HTTPS).
- Analytics: Cloudflare Web Analytics beacon (public, cookieless token in
  `astro.config.mjs`).
