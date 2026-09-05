/**
 * Issue の入手先。
 *
 * GitHub から取るのが本番で、ディレクトリから読むのは
 * **出す前の下書きを検査する**ため。同じ検査を両方に掛けられるようにしてある。
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Issue } from "./parse.ts";

/**
 * `gh api` を叩いて配列を返す。
 *
 * `--paginate` は JSON 配列を連結して返すことがある（`][` で繋がる）ので、
 * そのままでは JSON.parse が失敗する。区切って読み直す。
 */
function gh(args: readonly string[]): any[] {
  const out = execFileSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(`[${out.replace(/\]\s*\[/g, "],[")}]`).flat();
}

/** `gh` 経由で open な Issue を取る。PR は除く。 */
export function fromRepo(repo: string): Issue[] {
  return gh(["--paginate", `repos/${repo}/issues?state=open&per_page=100`])
    .filter((i) => !i.pull_request)
    .map((i) => ({ id: `#${i.number}`, title: String(i.title ?? ""), body: String(i.body ?? "") }));
}

export interface PullRequest {
  readonly id: string;
  readonly title: string;
  readonly files: readonly string[];
}

/**
 * 開いている PR と、それが触っているファイル。
 *
 * Issue どうしの重なりより、**すでに動いている PR との重なり**のほうが切実。
 * Issue はまだ着手前だが、PR はもう書かれているので、
 * ぶつかると捨てるのは必ずこれから始める方になる。
 *
 * PR 1件ごとに1回叩くので、多いリポジトリでは `limit` で頭を打つ。
 */
export function openPullFiles(repo: string, limit = 30): PullRequest[] {
  const list = gh([`repos/${repo}/pulls?state=open&per_page=100`]);
  return list.slice(0, limit).map((pr: any) => ({
    id: `PR #${pr.number}`,
    title: String(pr.title ?? ""),
    files: gh([`repos/${repo}/pulls/${pr.number}/files?per_page=100`, "--paginate"])
      .map((f: any) => String(f.filename)),
  }));
}

/** ディレクトリ直下の Markdown を、1ファイル1 Issue として読む。 */
export function fromDir(dir: string): Issue[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const body = readFileSync(join(dir, f), "utf8");
      const m = /^#\s+(.*)$/m.exec(body);
      return { id: f, title: m ? m[1].trim() : f.replace(/\.md$/, ""), body };
    });
}

/**
 * 追跡されているファイルの一覧。
 *
 * `git ls-files` を使うのは、`.gitignore` を自分で解釈したくないから。
 * ビルド成果物まで数えると、重なりの報告が使いものにならなくなる。
 */
export function trackedFiles(cwd: string): string[] {
  try {
    return execFileSync("git", ["ls-files"], { cwd, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
  } catch {
    return [];
  }
}
