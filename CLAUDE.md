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

**To review an unreleased package frontend, use `PACKAGE_PATH`**, which copies
from a local checkout and skips the clone:
`PACKAGE_PATH=../laravel-truss npm run build`, or `npm run dev:local` for the
dev server. **The variable has to be passed to the npm call that fires the hook**,
since `predev`, `prebuild` and `prepreview` all run the copy script: exporting it
earlier in a different shell, or running `astro dev` directly, both leave you
reading released assets while believing they are local. Such a build is stamped `local`
rather than a version, so its asset folder is `assets-local` and it cannot be
mistaken for a release; the suite fails while those assets are in place and says
to run `npm run copy-demo-assets` to restore them. Do not deploy a local build.

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

**Everything goes through a branch and a pull request.** Prose, a typo, a
component, a workflow, this file. There is no change small enough to push
straight to `main`.

A push to `main` here **is** the deploy, and `main` is protected: a pull request
is required and the `build` check has to pass. Pushing directly does not fail,
because the repository owner can bypass the rule, so the only thing standing
between a direct push and the live site is somebody deciding not to. That is the
reason the exception is gone.

This used to carve out prose and content, on the grounds that an `.mdx` page
cannot break a build. Two things were wrong with it. Bypassing protection also
skips `build`, so a prose push shipped with nothing checked at all. And the
carve-out asked for a judgement about whether a change is "only prose", which is
exactly the judgement that goes wrong on a mixed change, quietly and in the
direction of less review.

## Quoting other people

The `/in-the-wild/` page republishes coverage of Truss written by other people.
It is the only place on this site carrying somebody else's words, so it has rules
of its own.

**The rows are generated, not written here.** `markstone:in-the-wild:export`
writes `src/data/in-the-wild.generated.json` from the private tracker, where each
row already carries the decision to publish it and the reason.
`src/data/in-the-wild.ts` imports that file and holds the type, the sections and
the exclusion rules. **Do not hand-edit the JSON and do not append rows to
`MENTIONS`**: hand transcription is what this replaced, after one coverage row
was found carrying three different dates across three files. To change what the
page publishes, change the decision in Markstone and re-run the export.

**One test decides every row: was it written by somebody other than Alberto,
without being asked?** Both halves are required. An issue opened by a user on
the package repo is in, because authorship decides and not the domain. A
Laravel News Links entry is out, because it was submitted rather than sought.
Anything Alberto wrote is out wherever it was published. The rules are
executable, not advisory: `tests/in-the-wild.test.js` fails the build on a row
with no URL, no permission basis, a self-authored source, or a quote long enough
to be a reprint.

**No measurement of any kind appears on that page, including in a sort order.**
The private planning notes rank people by how they behaved and hold a reach
figure per row. None of that is published, and the page sorts by date so that
the ordering cannot leak it either.

**Quoted text is reproduced verbatim, including its em dashes.** This repo
forbids em dashes and en dashes in its own prose and a test enforces it. Other
people use them. If that test goes red on a quote, the carve-out is wrong or
missing: **never edit somebody's words to fit our punctuation.** The exemption
is by field, driven by `VERBATIM_FIELDS`, so adding a verbatim field to the type
means adding it there too.

**Never write a quote, a name, a role, a date or a URL from memory or from a
plausible reconstruction.** Every field comes from the source the row links to.
Candidate rows are assembled in the private planning notes and pasted in whole;
until a row has a URL and a permission basis it is not a row. An invented
testimonial on a public site is the one failure here that cannot be walked back.

## Conventions

- Keep docs accurate to the shipped **release**, not unreleased work.
- Never commit generated or fetched directories (`dist/`, `.astro/`, `_pkg/`,
  `public/demo/assets/`).
- **One generated file is tracked on purpose:
  `src/data/in-the-wild.generated.json`.** Nothing in this repo can produce it,
  the page imports it, and the build fails without it. **Do not gitignore it by
  applying the rule above**, which is about output this repo can rebuild.
- Personal, uncommitted preferences and planning notes live in `.docs/` and
  `CLAUDE.local.md` (both gitignored).
- **Git commits:** `type: short subject` (max 50 chars, no em dash), then a body
  explaining what and why rather than how. Use a heredoc for multi-line messages.
  **Never add AI-attribution trailers**: no `Co-Authored-By: Claude`, no
  `Claude-Session:`, no "Generated with Claude Code". The package repo and the
  private notes repo both state this; it was missing here, and the gap produced
  a pull request full of them.
- **Pull requests: short.** A few lines on what changed and why, and anything
  the reviewer has to decide before merging. Nothing else. No blow-by-blow of
  what broke, no test-by-test narration, no restating the diff in prose. The
  commits carry the depth and `git log` is where somebody goes looking for it,
  so a long PR body is the same story told twice and the second telling is the
  one that goes stale. The same applies to the AI-attribution rule above: it
  covers PR bodies too.
