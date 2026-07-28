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
then redeploy the docs.

## Commands

- `npm ci` then `npm run dev` — local dev at http://localhost:4321
- `npm run build` — static output in `dist/`
- Deploy: the **Deploy Documentation** workflow (manual, `workflow_dispatch`),
  which builds and ships to Netsons over SSH. Netsons' CI-SSH is flaky, so a run
  may need a re-dispatch.

## Working in this repo

Commit and push straight to `main`. This is a docs site, not the package, so it
does not need a branch + PR flow, unless there is a very good reason (for
example a risky or large change worth reviewing first).

## Conventions

- Keep docs accurate to the shipped **release**, not unreleased work.
- Never commit generated or fetched directories (`dist/`, `.astro/`, `_pkg/`,
  `public/demo/assets/`).
- Personal, uncommitted preferences and planning notes live in `.docs/` and
  `CLAUDE.local.md` (both gitignored).
