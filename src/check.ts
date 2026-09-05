/**
 * 検査ルール。
 *
 * この道具が答えるのは1つだけ:
 * **いま開いている Issue は、同時に走らせて安全か。**
 *
 * 並列開発が壊れる原因は、腕前ではなく Issue の切り方にある。
 * 2つの Issue が同じファイルを触るなら、それは並列に走らせてはいけない。
 * それは目で見て気づける規模を、すぐ超える。
 *
 * 誤検出は1件でも高くつくので、**推測でものを言わない**方針を守る。
 * 判定できないものは黙る。
 */
import { matchAll } from "./glob.ts";
import { type Lang, messages } from "./messages.ts";
import { type Issue, type Parsed, parse } from "./parse.ts";

export type Level = "error" | "warn";

export interface Finding {
  readonly level: Level;
  readonly rule: string;
  readonly where: string;
  readonly message: string;
  /** 具体例。重なったファイルなど、読んだ人がすぐ動けるもの */
  readonly detail?: readonly string[];
}

/**
 * 判定できない書き方の目印。
 *
 * **これだけでは指摘しない。** 具体的な値（コード・数字・引用）が
 * 1つも無いときに限って報告する。「正しく 404 を返す」は通す。
 */
const VAGUE = [
  "正しく", "適切に", "きちんと", "ちゃんと", "問題なく", "きれいに", "うまく",
  "properly", "correctly", "appropriately", "as expected", "works fine",
  "no issues", "looks good",
];

const hasConcrete = (s: string): boolean =>
  /`[^`]+`/.test(s) || /\d/.test(s) || /["'「『]/.test(s);

function checkOne(p: Parsed, m: ReturnType<typeof messages>): Finding[] {
  const out: Finding[] = [];
  const where = `${p.issue.id} ${p.issue.title}`;

  if (p.scopes === undefined) {
    out.push({
      level: "error",
      rule: "scope-missing",
      where,
      message: m.scopeMissing,
    });
  } else if (p.scopes.length === 0) {
    out.push({
      level: "error",
      rule: "scope-empty",
      where,
      message: m.scopeEmpty,
    });
  }

  if (p.criteria === undefined) {
    out.push({
      level: "error",
      rule: "criteria-missing",
      where,
      message: m.criteriaMissing,
    });
  } else {
    const vague = p.criteria.filter(
      (c) => !hasConcrete(c) && VAGUE.some((v) => c.toLowerCase().includes(v)),
    );
    if (vague.length > 0) {
      out.push({
        level: "warn",
        rule: "criteria-unverifiable",
        where,
        message: m.criteriaUnverifiable,
        detail: vague,
      });
    }
  }
  return out;
}

export interface Options {
  /** リポジトリのファイル一覧。空なら scope-unmatched は検査しない */
  readonly files: readonly string[];
  /** 既定は英語 */
  readonly lang?: Lang;
}

export function check(issues: readonly Issue[], opts: Options): Finding[] {
  const m = messages(opts.lang ?? "en");
  const parsed = issues.map(parse);
  const out: Finding[] = [];
  const expanded = new Map<string, Set<string>>();

  // Issue ごとに、その Issue の指摘をまとめて出す。
  // 散らばっていると、1つ直すのに出力を何度も往復することになる
  for (const p of parsed) {
    out.push(...checkOne(p, m));
    if (!p.scopes || p.scopes.length === 0) continue;
    expanded.set(p.issue.id, matchAll(p.scopes, opts.files));

    if (opts.files.length > 0) {
      const dead = p.scopes.filter((s) => matchAll([s], opts.files).size === 0);
      if (dead.length > 0) {
        out.push({
          level: "warn",
          rule: "scope-unmatched",
          where: `${p.issue.id} ${p.issue.title}`,
          message: m.scopeUnmatched,
          detail: dead,
        });
      }
    }
  }

  // 本命。2つずつ突き合わせて、共通するファイルを報告する
  const byId = new Map(parsed.map((p) => [p.issue.id, p]));
  const ids = [...expanded.keys()];
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = byId.get(ids[i])!;
      const b = byId.get(ids[j])!;
      if (a.allowOverlap || b.allowOverlap) continue;
      const shared = [...expanded.get(ids[i])!].filter((f) => expanded.get(ids[j])!.has(f));
      if (shared.length === 0) continue;
      out.push({
        level: "error",
        rule: "scope-overlap",
        where: `${a.issue.id} ✕ ${b.issue.id}`,
        message: m.scopeOverlap,
        detail: shared.slice(0, 10),
      });
    }
  }
  return out;
}
