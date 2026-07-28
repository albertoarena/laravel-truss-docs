# Laravel Truss, documentation site

The documentation website for [Laravel Truss](https://github.com/albertoarena/laravel-truss),
published at **[trussphp.com](https://trussphp.com)**. Built with
[Astro](https://astro.build) + [Starlight](https://starlight.astro.build).

## Local development

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # static output in dist/
```

## The live demo

The `/demo/` page runs the package's actual shipped frontend. Those assets are
not committed here; a prebuild step fetches them from the public package repo
(`albertoarena/laravel-truss`) and copies them into `public/demo/assets/`
(generated, gitignored). By default it pins to the **latest package release**;
override with `PACKAGE_REF` (e.g. `PACKAGE_REF=main npm run build`).

## Deployment

Server-pull model: CI (`.github/workflows/publish.yml`) builds the site and
publishes it to the `deploy` branch; the host pulls that branch over HTTPS on a
cron (`scripts/server-deploy.sh`) and flips a `current` symlink. Just push to
`main` and the site updates within a few minutes, no secrets needed. Full
runbook: [DEPLOYMENT.md](DEPLOYMENT.md).
