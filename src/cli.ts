#!/usr/bin/env node
/**
 * scopecheck — 開いている Issue を、同時に走らせて安全か検査する。
 *
 *   node src/cli.ts --repo owner/name
 *   node src/cli.ts --dir drafts/
 *
 * 終了コード: error があれば 1。--strict なら warn でも 1。
 */
import { check } from "./check.ts";
import { exitCode, formatGithub, formatHuman, formatJson, type Result } from "./report.ts";
import { messages, pickLang } from "./messages.ts";
import { fromDir, fromRepo, openPullFiles, trackedFiles } from "./sources.ts";

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const has = (name: string): boolean => args.includes(`--${name}`);

const lang = pickLang(args.indexOf("--lang") >= 0 ? args[args.indexOf("--lang") + 1] : undefined);
const M = messages(lang);

if (has("help") || args.length === 0) {
  console.log(`scopecheck - tells you whether open Issues can run in parallel

  scopecheck --repo owner/name [options]
  scopecheck --dir  drafts/    [options]

Options:
  --repo owner/name           read open Issues from GitHub (requires gh)
  --dir  path                 read *.md in a directory, one file per Issue
  --root path                 working copy whose files are matched (default: cwd)
  --format human|github|json  output format (default: human)
  --lang   en|ja              message language (default: en, or SCOPECHECK_LANG)
  --no-prs                    skip the comparison against open pull requests
  --strict                    exit 1 on warnings too
  --help                      this

Checks:
  scope-overlap          two Issues match the same file
  scope-inflight         an Issue's scope is already being edited by an open PR
  scope-missing/empty    no scope is declared
  scope-unmatched        a pattern matches nothing in the repository
  criteria-missing       no acceptance criteria
  criteria-unverifiable  a criterion with no concrete value in it

Exit codes: 0 clean, 1 findings, 2 the check could not run.

Anything it cannot decide, it does not report. A false positive costs more
than a missed one, because it is what makes people stop reading the output.`);
  process.exit(0);
}

const repo = flag("repo");
const dir = flag("dir");
if (!repo && !dir) {
  console.error(M.needSource);
  process.exit(2);
}

let issues;
try {
  issues = repo ? fromRepo(repo) : fromDir(dir!);
} catch (e) {
  console.error(M.fetchFailed((e as Error).message));
  process.exit(2);
}

const files = trackedFiles(flag("root") ?? process.cwd());

// 開いている PR との衝突も見る。--repo のときだけ（ローカルには PR が無い）
let inFlight;
if (repo && !has("no-prs")) {
  try {
    inFlight = openPullFiles(repo);
  } catch (e) {
    // PR が取れなくても Issue どうしの検査は成立する。黙って落とさない
    console.error(`(open PR を取得できませんでした: ${(e as Error).message})`);
  }
}

const findings = check(issues, { files, inFlight, lang });
const result: Result = {
  findings,
  checked: issues.map((i) => i.id),
  files: files.length,
  lang,
};

const format = flag("format") ?? "human";
if (format === "json") console.log(formatJson(result));
else if (format === "github") console.log(formatGithub(result));
else console.log(formatHuman(result, process.stdout.isTTY === true));

process.exit(exitCode(result, has("strict")));
