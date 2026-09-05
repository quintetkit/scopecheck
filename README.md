# scopecheck

Tells you whether your open GitHub Issues can safely be worked on in parallel.

It reads each open Issue, expands the file patterns it declares, and reports the
Issues whose scopes **overlap on a concrete file**. That is the failure that
wrecks parallel work: two agents (or two people) editing the same file from two
branches, discovered at merge time.

```
$ scopecheck --repo acme/api

error #12 ✕ #14
      Their scopes overlap. Running these at the same time guarantees a
      conflict for whichever lands second.
        src/types.ts
        src/routes/index.ts
      scope-overlap

warn  #17 Add rate limiting
      A pattern matches no files. It may be a typo, or a path that is gone.
        src/middleware/**
      scope-unmatched

error 1 problem / 1 warning (7 issues checked)
```

## Why this exists

Splitting work into parallel tasks fails for a boring reason: the tasks are not
actually independent. Two of them touch a shared file — a route table, a barrel
of type definitions, a DI container — and the second branch to merge has to be
redone.

You can see this by hand for three Issues. You cannot for fifteen. The
declaration is already in the Issue; nothing checks it.

## Install

Requires Node 22.6 or newer (it runs TypeScript directly, no build step) and
[`gh`](https://cli.github.com/) if you read Issues from GitHub.

```bash
git clone https://github.com/quintetkit/scopecheck
node scopecheck/src/cli.ts --repo owner/name
```

## Use

```bash
# open Issues from a repository
scopecheck --repo owner/name

# local drafts, one Markdown file per Issue, before you post them
scopecheck --dir drafts/

# in CI
scopecheck --repo owner/name --format github --strict
```

`--root` points at the working copy whose files are used for matching; it
defaults to the current directory. **The file list comes from `git ls-files`**,
so ignored and generated files never count as an overlap.

## What it checks

| rule | level | what it means |
|---|---|---|
| `scope-overlap` | error | Two Issues match the same file. Names the files. |
| `scope-missing` | error | No scope section. Nothing to compare. |
| `scope-empty` | error | The section exists but declares no path. |
| `scope-unmatched` | warn | A pattern matches nothing in the repository. |
| `criteria-missing` | error | No acceptance criteria for a reviewer to judge against. |
| `criteria-unverifiable` | warn | A criterion with no concrete value in it. |

`criteria-unverifiable` is deliberately narrow. It fires only when a line
contains a vague word **and** contains no code span, no number, and no quoted
string. "Returns 401 correctly" passes. "Works correctly" does not.

## What an Issue needs

A heading for scope and one for acceptance criteria. Japanese and English
headings are both recognised (`Scope` / `対象範囲`, `Acceptance criteria` /
`受け入れ条件`).

```markdown
## Scope

- `src/auth/**`
- `src/routes/login.tsx`

## Acceptance criteria

- Posting an unregistered email returns 401 with `USER_NOT_FOUND`
- `npm test -- auth` passes
```

Patterns support `**`, `*` and `?`. A pattern with no wildcard matches that path
and everything under it, so `src/auth` means `src/auth/**`.

If two Issues are meant to share a file, say so in the Issue body and the
overlap is not reported:

```markdown
<!-- scopecheck: allow-overlap -->
```

## Exit codes

| code | meaning |
|---|---|
| 0 | nothing to report |
| 1 | at least one error (or any finding with `--strict`) |
| 2 | **the check could not run** — the file list was empty, so overlaps were never compared |

Code 2 exists on purpose. A checker that cannot see the repository must not
return the same "0" as one that looked and found nothing.

## Tried on a real repository

Run against the 11 Issues of
[mdlinkcheck](https://github.com/quintetkit/mdlinkcheck), a small CLI built
entirely through this Issue-based workflow:

```
5 error / 0 warning (11 issues checked)
```

**Five pairs declare a shared file.** Those five could not have run in parallel.
They were in fact worked one at a time, so nothing actually broke — but nothing
told anyone that in advance either. No false positives on that run.

## GitHub Actions

```yaml
- uses: quintetkit/scopecheck@v1
  with:
    repo: ${{ github.repository }}
```

## Related

Built with [Quartet](https://github.com/quintetkit/quartet), a free MIT
configuration that splits Claude Code into Architect / Coder / Reviewer /
Conflict Resolver personas around GitHub Issues. scopecheck mechanises the rule
that workflow depends on: **Issues that share files must not run in parallel.**

[ccheck](https://github.com/quintetkit/ccheck) lints `.claude/` configuration,
citing the documentation for every finding.

## License

MIT
