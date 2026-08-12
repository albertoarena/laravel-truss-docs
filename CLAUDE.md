# CLAUDE.md — Instructions for Claude Code (laravel-truss-docs)

## What this is

The documentation website for **Laravel Truss**, the Composer package at
[`albertoarena/laravel-truss`](https://github.com/albertoarena/laravel-truss).
Published at **https://trussphp.com**. Built with Astro + Starlight. This repo
contains ONLY the docs site; the package itself (PHP source, the shipped
frontend, tests) lives in the package repo.

## Source of truth: the package drives the docs

This site documents `albertoarena/laravel-truss`, and its content **must be kept
in sync with that package**. Whenever the package changes a command, a config
option, exports, or any user-facing behavior, the corresponding page here must
be updated to match. The package repo is authoritative: if the docs and the
package disagree, the package is right and the docs are the bug to fix. Treat a
package change and its docs update as one unit of work across the two repos.

## The live demo pulls the package's shipped frontend

The `/demo/` page runs the package's ACTUAL shipped frontend. Those runtime
assets are not committed here: `scripts/copy-demo-assets.mjs` fetches
`resources/` from the public package repo at build time (pinned to the latest
package **release**; override with `PACKAGE_REF`, e.g. `PACKAGE_REF=main`) into
`public/demo/assets/` (generated, gitignored). Never hand-edit
`public/demo/assets/`; change the frontend in the package repo and cut a release,
then rebuild this site (push to `main` or re-run the Publish workflow) so the
demo picks up the newly released frontend.

## Commands

- `npm ci` then `npm run dev` — local dev at http://localhost:4321
- `npm run build` — static output in `dist/`
- Deploy is a **server-pull** model, no inbound SSH. A push to `main` runs the
  **Publish** workflow (`publish.yml`), which builds the site and force-pushes
  the built output to the `deploy` branch. A cron job on the Netsons server
  pulls that branch over HTTPS and swaps it in via an atomic release symlink.
  Trigger a redeploy by pushing to `main` or re-running Publish
  (`workflow_dispatch`). See `DEPLOYMENT.md` for the full runbook.

## Working in this repo

**Which flow applies depends on what the change touches, not on the fact that
this is the docs repo.**

- **Straight to `main`:** prose and content. `.mdx` pages under
  `src/content/docs/`, `README.md`, and Claude-facing files like this one.
- **Branch + PR:** anything else. `.astro` components and layouts, `.css`,
  `astro.config.mjs`, `package.json`, lockfiles, scripts, CI workflows. A mixed
  change follows the code side and gets a PR.

A push to `main` here **is** the deploy, so the PR is what keeps a code change
off the live site until it has been looked at. Do not treat "it is only the docs
site" as a reason to skip it: a CSS or layout change is a code change wherever
it lives.

## Conventions

- Keep docs accurate to the shipped **release**, not unreleased work.
- Never commit generated or fetched directories (`dist/`, `.astro/`, `_pkg/`,
  `public/demo/assets/`).
- Personal, uncommitted preferences and planning notes live in `.docs/` and
  `CLAUDE.local.md` (both gitignored).
