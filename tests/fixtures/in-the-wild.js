/**
 * Rows for exercising the /in-the-wild curation rules.
 *
 * INVENTED, and deliberately obviously so. Nobody named here exists, every URL
 * points at example.com, and none of it is ever rendered: tests/in-the-wild.js
 * asserts that nothing under src/ imports this file. The published set lives in
 * src/data/in-the-wild.ts and takes only real, sourced rows.
 *
 * They exist because the published set is empty until the candidate list is
 * assembled privately, and rules that have never rejected anything are not
 * known to work. Each invalid row carries the reason it must fail, so a rule
 * that quietly stops applying takes a test with it.
 */

/** Rows that must pass, one per shape the page supports. */
export const VALID = [
  {
    kind: 'press',
    quote: 'A fixture sentence standing in for an editorial paragraph.',
    author: 'Fixture Editor',
    role: 'Staff writer',
    source: 'Laravel News',
    url: 'https://example.com/fixtures/editorial',
    date: '2026-08-10',
    basis: 'public-post',
  },
  {
    kind: 'community',
    quote: 'Uma frase de exemplo, para exercitar o atributo lang.',
    quoteLang: 'pt-BR',
    translation: 'An example sentence, to exercise the lang attribute.',
    author: 'Fixture Developer',
    // Keeps an em dash in the fixture set on purpose: this is the shape of a
    // real headline, and this repo's house style forbids the character in its
    // own prose. Harmless here because the style scan reads src/ only, which is
    // exactly why the carve-out is tested against the scan itself.
    role: 'ship production AI — LLMs, RAG, workflow automation',
    source: 'LinkedIn',
    url: 'https://example.com/fixtures/post',
    date: '2026-08-14',
    basis: 'permission-given',
  },
  {
    kind: 'community',
    author: 'Fixture Reader',
    source: 'X',
    url: 'https://example.com/fixtures/quoteless',
    date: '2026-08-02',
    basis: 'public-post',
  },
  {
    kind: 'report',
    quote: 'Fails on a schema with more than a hundred tables.',
    author: 'Fixture Reporter',
    source: 'GitHub',
    url: 'https://example.com/fixtures/issue',
    date: '2026-07-29',
    fixedIn: 'v0.0.1',
    basis: 'public-post',
  },
]

/**
 * Rows that must fail, each with the substring the failure has to mention.
 *
 * The `expect` string is matched loosely against the reported problems, so a
 * rewording of a message does not break the suite but a rule going missing does.
 */
export const INVALID = [
  {
    why: 'no URL, so nothing can be verified',
    expect: 'no URL',
    row: {
      kind: 'community',
      quote: 'Said something kind.',
      author: 'Fixture Developer',
      source: 'LinkedIn',
      date: '2026-08-14',
      basis: 'public-post',
    },
  },
  {
    why: 'no permission basis, so nobody decided whether to ask',
    expect: 'permission basis',
    row: {
      kind: 'community',
      quote: 'Said something kind.',
      author: 'Fixture Developer',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/post',
      date: '2026-08-14',
    },
  },
  {
    why: 'written by the maintainer, which is the whole exclusion',
    expect: 'maintainer',
    row: {
      kind: 'community',
      quote: 'Truss now does schema diff.',
      author: 'Alberto Arena',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/own-post',
      date: '2026-08-14',
      basis: 'public-post',
    },
  },
  {
    why: 'a self-authored domain, whoever the author field claims',
    expect: 'albertoarena.it',
    row: {
      kind: 'press',
      quote: 'Introducing Truss.',
      author: 'Fixture Editor',
      source: 'Blog',
      url: 'https://albertoarena.it/laravel-truss',
      date: '2026-08-10',
      basis: 'public-post',
    },
  },
  {
    why: 'a subdomain of a self-authored domain is still the same author',
    expect: 'albertoarena.it',
    row: {
      kind: 'press',
      quote: 'Introducing Truss.',
      author: 'Fixture Editor',
      source: 'Blog',
      url: 'https://notes.albertoarena.it/laravel-truss',
      date: '2026-08-10',
      basis: 'public-post',
    },
  },
  {
    why: 'a Laravel News Links entry is submitted, not written',
    expect: 'laravel-news.com',
    row: {
      kind: 'press',
      author: 'Fixture Editor',
      source: 'Laravel News',
      url: 'https://laravel-news.com/links/laravel-truss',
      date: '2026-08-11',
      basis: 'public-post',
    },
  },
  {
    why: 'the README is the same author even though users open issues on the same repo',
    expect: 'github.com',
    row: {
      kind: 'report',
      author: 'Fixture Reporter',
      source: 'GitHub',
      url: 'https://github.com/albertoarena/laravel-truss/blob/main/README.md',
      date: '2026-07-29',
      basis: 'public-post',
    },
  },
  {
    why: 'a reprint rather than a pull-quote',
    expect: 'pull-quote is not a reprint',
    row: {
      kind: 'community',
      quote: 'x'.repeat(301),
      author: 'Fixture Developer',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/long',
      date: '2026-08-14',
      basis: 'public-post',
    },
  },
  {
    why: 'a translation with nothing saying what language it came from',
    expect: 'quoteLang',
    row: {
      kind: 'community',
      quote: 'Uma frase de exemplo.',
      translation: 'An example sentence.',
      author: 'Fixture Developer',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/untagged',
      date: '2026-08-14',
      basis: 'public-post',
    },
  },
  {
    why: 'a kind with no section would render nowhere',
    expect: 'no section',
    row: {
      kind: 'announcement',
      author: 'Fixture Developer',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/wrong-kind',
      date: '2026-08-14',
      basis: 'public-post',
    },
  },
  {
    why: 'a report with no release to point at',
    expect: 'no release',
    row: {
      kind: 'report',
      quote: 'Fails on a schema with more than a hundred tables.',
      author: 'Fixture Reporter',
      source: 'GitHub',
      url: 'https://example.com/fixtures/unfixed',
      date: '2026-07-29',
      basis: 'public-post',
    },
  },
  {
    why: 'an unparseable date cannot be sorted or spelled out',
    expect: 'does not parse',
    row: {
      kind: 'community',
      author: 'Fixture Developer',
      source: 'LinkedIn',
      url: 'https://example.com/fixtures/bad-date',
      date: '14th of August',
      basis: 'public-post',
    },
  },
]

/** An issue opened by a user on Alberto's own repo: the domain is his, the words are not. */
export const USER_ISSUE = {
  kind: 'report',
  quote: 'Nothing renders past the first connection.',
  author: 'Fixture Reporter',
  source: 'GitHub',
  url: 'https://github.com/albertoarena/laravel-truss/issues/2',
  date: '2026-07-29',
  fixedIn: 'v0.0.1',
  basis: 'public-post',
}
