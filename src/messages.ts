/**
 * 利用者に見える文言。
 *
 * 既定は英語。README も Issue も英語で読む人に向けて出すため。
 * `--lang ja` か `SCOPECHECK_LANG=ja` で日本語になる。
 *
 * **文言を1か所に集めてあるのは、片方の言語だけ直る事故を防ぐため。**
 * 型で対応が取れているので、追加すると両方書くまでコンパイルが通らない。
 */
export type Lang = "en" | "ja";

interface Messages {
  readonly scopeMissing: string;
  readonly scopeEmpty: string;
  readonly scopeUnmatched: string;
  readonly scopeOverlap: string;
  readonly criteriaMissing: string;
  readonly criteriaUnverifiable: string;
  readonly nothingToCheck: string;
  readonly noProblems: (n: number) => string;
  readonly summary: (e: number, w: number, n: number) => string;
  readonly notice: string;
  readonly blindSpot: string;
  readonly needSource: string;
  readonly fetchFailed: (m: string) => string;
}

const EN: Messages = {
  scopeMissing:
    "No scope section. An Issue that does not declare which files it touches "
    + "cannot be compared against the others.",
  scopeEmpty: "The scope section is present but declares no path.",
  scopeUnmatched:
    "A pattern matches no file. It may be a typo, or a path that is already gone.",
  scopeOverlap:
    "Their scopes overlap. Running these at the same time guarantees a conflict "
    + "for whichever lands second.",
  criteriaMissing:
    "No acceptance criteria. A reviewer has nothing to judge the result against.",
  criteriaUnverifiable:
    "An acceptance criterion cannot be judged: it contains no concrete value "
    + "(no command, status code, or quoted string).",
  nothingToCheck: "No issues to check. Verify --repo or --dir.",
  noProblems: (n) => `No problems (${n} issues checked)`,
  summary: (e, w, n) => `${e} error / ${w} warning (${n} issues checked)`,
  notice: "Note",
  blindSpot:
    "The repository file list was empty (git ls-files returned nothing).\n"
    + "  scope-overlap and scope-unmatched were NOT checked.\n"
    + "  Point --root at the working copy.",
  needSource: "Pass either --repo or --dir. See --help.",
  fetchFailed: (m) => `Could not read the issues: ${m}`,
};

const JA: Messages = {
  scopeMissing:
    "対象範囲の節がありません。どのファイルを触るか宣言されていない Issue は、"
    + "他の Issue と突き合わせられません。",
  scopeEmpty: "対象範囲の節はありますが、パスが1つも書かれていません。",
  scopeUnmatched:
    "どのファイルにも当たらないパターンがあります。"
    + "打ち間違いか、すでに消えたパスの可能性があります。",
  scopeOverlap:
    "対象範囲が重なっています。この2つを同時に走らせると、"
    + "あとから出す方が必ずコンフリクトします。",
  criteriaMissing: "受け入れ条件がありません。レビュアーが判定の根拠を持てません。",
  criteriaUnverifiable:
    "判定できない受け入れ条件があります。具体的な値（コマンド・状態コード・"
    + "文字列）が1つも含まれていません。",
  nothingToCheck: "検査対象の Issue がありません。--repo か --dir を確認してください。",
  noProblems: (n) => `問題なし（Issue ${n} 件を検査）`,
  summary: (e, w, n) => `error ${e} 件 / warn ${w} 件（Issue ${n} 件を検査）`,
  notice: "注意",
  blindSpot:
    "リポジトリのファイル一覧が空でした（git ls-files が何も返していません）。\n"
    + "  scope-overlap と scope-unmatched は検査していません。\n"
    + "  --root にリポジトリを指してください。",
  needSource: "--repo か --dir のどちらかが要ります。--help を見てください。",
  fetchFailed: (m) => `Issue を取得できませんでした: ${m}`,
};

export const messages = (lang: Lang): Messages => (lang === "ja" ? JA : EN);

export function pickLang(explicit?: string): Lang {
  const v = explicit ?? process.env.SCOPECHECK_LANG ?? "";
  return v.toLowerCase().startsWith("ja") ? "ja" : "en";
}
