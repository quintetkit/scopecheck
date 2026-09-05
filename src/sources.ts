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

/** `gh` 経由で open な Issue を取る。PR は除く。 */
export function fromRepo(repo: string): Issue[] {
  const out = execFileSync(
    "gh",
    ["api", "--paginate", `repos/${repo}/issues?state=open&per_page=100`],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  // --paginate は JSON 配列を連結して返すことがあるので、配列ごとに読む
  const chunks = out.replace(/\]\s*\[/g, "],[");
  const items: any[] = JSON.parse(`[${chunks}]`).flat();
  return items
    .filter((i) => !i.pull_request)
    .map((i) => ({ id: `#${i.number}`, title: String(i.title ?? ""), body: String(i.body ?? "") }));
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
