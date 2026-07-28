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

`Deploy Documentation` (`.github/workflows/deploy.yml`) builds the site and
deploys it to Netsons over SSH (tarball + `current` symlink releases). It is
manual (`workflow_dispatch`). Requires repo Secrets `SSH_HOST`, `SSH_USER`,
`SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `SSH_KEY_PASSPHRASE` (optional `SSH_PORT`),
and Variable `DEPLOY_PATH`.
