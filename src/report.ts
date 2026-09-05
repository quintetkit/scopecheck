/**
 * 検査結果の出力。
 *
 * 「重なっている」とだけ言われても直せない。
 * **どのファイルが重なっているか**まで出す。
 */
import type { Finding } from "./check.ts";
import { type Lang, messages } from "./messages.ts";

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const DIM = "\x1b[2m";

const color = (on: boolean, code: string, s: string): string => (on ? `${code}${s}${RESET}` : s);

export interface Result {
  readonly findings: readonly Finding[];
  /** 実際に読んだ Issue。0件だったのか、見て問題が無かったのかを区別する */
  readonly checked: readonly string[];
  /** 出力言語。既定は英語 */
  readonly lang?: Lang;
  /**
   * 突き合わせに使えたファイル数。
   *
   * 0 なら、重なりの検査は**動いていない**。
   * 検査が動いていないことと、検査に通ったことを同じ「成功」にしてはいけない。
   */
  readonly files: number;
}

/** 重なりの検査が成立しなかったときの説明。成立していれば undefined。 */
export function blindSpot(r: Result): string | undefined {
  if (r.files > 0 || r.checked.length === 0) return undefined;
  return messages(r.lang ?? "en").blindSpot;
}

export function formatHuman(r: Result, tty: boolean): string {
  const m = messages(r.lang ?? "en");
  if (r.checked.length === 0) return m.nothingToCheck;
  const blind = blindSpot(r);
  if (r.findings.length === 0) {
    const head = m.noProblems(r.checked.length);
    return blind ? `${head}\n\n${m.notice}: ${blind}` : head;
  }
  const lines: string[] = [];
  for (const f of r.findings) {
    const tag = f.level === "error"
      ? color(tty, RED, "error")
      : color(tty, YELLOW, "warn ");
    lines.push(`${tag} ${f.where}`);
    lines.push(`      ${f.message}`);
    for (const d of f.detail ?? []) lines.push(`        ${color(tty, DIM, d)}`);
    lines.push(`      ${color(tty, DIM, f.rule)}`);
    lines.push("");
  }
  const e = r.findings.filter((f) => f.level === "error").length;
  const w = r.findings.length - e;
  lines.push(m.summary(e, w, r.checked.length));
  if (blind) lines.push(`\n${m.notice}: ${blind}`);
  return lines.join("\n");
}

/** GitHub Actions のログに畳んで出す形式。 */
export function formatGithub(r: Result): string {
  const blind = blindSpot(r);
  const lines = r.findings.map((f) => {
    const kind = f.level === "error" ? "error" : "warning";
    const detail = (f.detail ?? []).join(", ");
    const body = detail ? `${f.message} ${detail}` : f.message;
    return `::${kind} title=${f.rule}::${f.where} ${body}`;
  });
  if (blind) lines.unshift(`::warning title=not-checked::${blind.replace(/\n\s*/g, " ")}`);
  return lines.join("\n");
}

export const formatJson = (r: Result): string => JSON.stringify(r, null, 2);

export function exitCode(r: Result, strict: boolean): number {
  // 重なりを見られなかったのに 0 を返すと、「検査に通った」と読まれる。
  // 分からないときは通さない
  if (blindSpot(r)) return 2;
  if (r.findings.some((f) => f.level === "error")) return 1;
  return strict && r.findings.length > 0 ? 1 : 0;
}
