/**
 * fixtures に対する検査結果を突き合わせる。
 *
 * **clean で1件も出さないこと**を厳密に要求する。
 * 壊れた入力を見つけられるより、正しい入力を誤って責めないことのほうが重い。
 */
import { check } from "../src/check.ts";
import { fromDir } from "../src/sources.ts";
import { match, toRegExp } from "../src/glob.ts";

const F = new URL("./fixtures/", import.meta.url).pathname;

/** fixtures が想定しているリポジトリの中身 */
const FILES = [
  "README.md",
  "src/auth/login.ts",
  "src/auth/token.ts",
  "src/config.ts",
  "src/profile/edit.tsx",
  "src/routes/login.tsx",
  "src/types.ts",
];

let failed = 0;
const ok = (cond: boolean, label: string): void => {
  if (!cond) {
    console.error(`  NG  ${label}`);
    failed += 1;
  }
};

// ---------------------------------------------------------------- glob
console.log("glob");
ok(match("src/**", FILES).length === 6, "src/** は src 配下すべて");
ok(match("src/*.ts", FILES).join() === "src/config.ts,src/types.ts",
   "src/*.ts は直下だけ（src/auth/login.ts を含まない）");
ok(match("**/*.tsx", FILES).length === 2, "**/*.tsx は深さを問わない");
ok(match("src/auth", FILES).length === 2, "ワイルドカード無しは配下に当てる");
ok(match("README.md", FILES).join() === "README.md", "ファイル名そのもの");
ok(match("src/?ypes.ts", FILES).join() === "src/types.ts", "? は1文字");
ok(match("src/nope/**", FILES).length === 0, "当たらないものは 0 件");
ok(toRegExp("a.b").test("a.b") && !toRegExp("a.b").test("axb"), ". はメタ文字にしない");

// ---------------------------------------------------------------- clean
console.log("clean");
const cleanFindings = check(fromDir(`${F}clean`), { files: FILES });
ok(cleanFindings.length === 0,
   `clean は 0 件であるべき。出たもの: ${cleanFindings.map((f) => f.rule).join(", ")}`);

// ---------------------------------------------------------------- broken
console.log("broken");
const b = check(fromDir(`${F}broken`), { files: FILES });
const rules = b.map((f) => f.rule);
const want = [
  "scope-overlap", "scope-missing", "scope-unmatched",
  "criteria-missing", "criteria-unverifiable",
];
for (const r of want) ok(rules.includes(r), `broken に ${r} が出る`);

const overlap = b.find((f) => f.rule === "scope-overlap");
ok(overlap?.detail?.join() === "src/types.ts",
   `重なったファイルを名指しする（出たもの: ${overlap?.detail?.join()}）`);
ok(b.filter((f) => f.rule === "scope-overlap").length === 1,
   "重なりは 01 と 02 の1組だけ");

const vague = b.filter((f) => f.rule === "criteria-unverifiable");
ok(vague.length === 2, `曖昧な条件は2件（出たもの: ${vague.length}）`);
ok(!rules.includes("scope-empty"), "空の scope は無い");

// 401 を含む条件は曖昧語が無くても具体的なので通す
ok(!b.some((f) => f.detail?.some((d) => d.includes("401"))), "数字がある条件は責めない");

// ---------------------------------------------------------------- allow-overlap
console.log("allow-overlap");
const allowed = check([
  { id: "#1", title: "a", body: "## 対象範囲\n\n- `src/types.ts`\n\n## 受け入れ条件\n\n- `x` が 1 になる" },
  {
    id: "#2",
    title: "b",
    body: "<!-- scopecheck: allow-overlap -->\n## 対象範囲\n\n- `src/types.ts`\n\n"
      + "## 受け入れ条件\n\n- `y` が 2 になる",
  },
], { files: FILES });
ok(!allowed.some((f) => f.rule === "scope-overlap"), "明示的に許可された重なりは報告しない");

// -------------------------------------------- 実際の Issue（回帰用）
// 実データの Scope はコードブロックに1行で並んでいた。
// 作りかけの parser はこれを1つも読めず、全部 scope-empty にしていた
console.log("real issues");
const { readFileSync } = await import("node:fs");
const real = JSON.parse(readFileSync(`${F}real-issues.json`, "utf8"))
  .map((i: any) => ({ id: `#${i.number}`, title: i.title, body: i.body ?? "" }));
const realFiles = [
  "README.md", ".github/workflows/self-check.yml", ".github/workflows/ci.yml",
  "src/cli.ts", "src/core/check.ts", "bin/mdlinkcheck.js", "action.yml", "package.json",
];
const realFindings = check(real, { files: realFiles });
ok(real.length === 11, "実データ 11 件");
ok(!realFindings.some((f) => f.rule === "scope-empty"),
   `コードブロックの Scope を読めている（scope-empty が ${
     realFindings.filter((f) => f.rule === "scope-empty").length} 件）`);
ok(realFindings.some((f) => f.rule === "scope-overlap"),
   "同時に開いていれば重なる組がある");

// ------------------------------------------------- 検査できなかったとき
console.log("blind spot");
const { blindSpot, exitCode } = await import("../src/report.ts");
const noFiles = { findings: [], checked: ["#1"], files: 0 };
ok(blindSpot(noFiles) !== undefined, "ファイル一覧が空なら、その旨を返す");
ok(exitCode(noFiles, false) === 2,
   "重なりを見られなかったときは 0 を返さない（通ったと読まれるため）");
ok(blindSpot({ findings: [], checked: ["#1"], files: 3 }) === undefined,
   "見られたときは何も言わない");
ok(blindSpot({ findings: [], checked: [], files: 0 }) === undefined,
   "そもそも Issue が無いときは、見られなかったとは言わない");

console.log(failed === 0 ? "\nすべて通過" : `\n${failed} 件が失敗`);
process.exit(failed === 0 ? 0 : 1);
