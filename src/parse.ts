/**
 * Issue 本文から「対象範囲」と「受け入れ条件」を取り出す。
 *
 * 見出しは日本語と英語の両方を受ける。Quartet の Issue テンプレートが
 * 日本語で、読者の多くは英語のテンプレートを使うため。
 */

export interface Issue {
  /** 表示用の識別子。GitHub なら "#12"、ファイルならファイル名 */
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export interface Parsed {
  readonly issue: Issue;
  /** 対象範囲の節が無いときは undefined。空配列（節はあるが中身が無い）と区別する */
  readonly scopes: string[] | undefined;
  readonly criteria: string[] | undefined;
  /** 本文に overlap を許すと書いてあるか */
  readonly allowOverlap: boolean;
}

const SCOPE_HEADINGS = ["対象範囲", "スコープ", "scope", "files in scope", "in scope"];
const CRITERIA_HEADINGS = [
  "受け入れ条件", "完了条件", "acceptance criteria", "acceptance", "done when",
];

const ALLOW_OVERLAP = /<!--\s*scopecheck:\s*allow-overlap\s*-->/i;

/** 見出し行から、その次の見出しまでを返す。見出しが無ければ undefined。 */
function section(body: string, names: readonly string[]): string | undefined {
  const lines = body.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const text = m[2].trim().toLowerCase().replace(/[:：]$/, "");
    if (!names.some((n) => text === n || text.startsWith(`${n} `) || text.startsWith(`${n}（`))) {
      continue;
    }
    const depth = m[1].length;
    const out: string[] = [];
    for (let j = i + 1; j < lines.length; j += 1) {
      const h = /^(#{1,6})\s+/.exec(lines[j]);
      if (h && h[1].length <= depth) break;
      out.push(lines[j]);
    }
    return out.join("\n");
  }
  return undefined;
}

/**
 * 節の中の項目を拾う。
 *
 * 箇条書き（`-` `*` `+`）とチェックボックスと、コードブロックの中の行を受ける。
 * **コードブロックを受けるのが大事**で、パスを書く人はだいたいそこに書く。
 */
function items(text: string): string[] {
  const out: string[] = [];
  let inFence = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      // コードブロックの中は、1行にカンマや空白で並べて書かれることが多い。
      //   README.md, .github/workflows/self-check.yml
      // 実際の Issue がこの形だったので、行のまま扱うと1つも読み取れない
      for (const tok of line.split(/[,\s]+/)) if (tok) out.push(tok);
      continue;
    }
    const m = /^[-*+]\s+(?:\[[ xX]\]\s+)?(.*)$/.exec(line);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

/** 項目からパスらしき部分を取り出す。`` `src/**` — 認証まわり `` のような書き方に耐える。 */
function toPattern(item: string): string | undefined {
  const code = /`([^`]+)`/.exec(item);
  const raw = (code ? code[1] : item.split(/\s+[—–-]\s+/)[0]).trim();
  if (!raw || /\s/.test(raw)) return undefined;
  return raw;
}

export function parse(issue: Issue): Parsed {
  const scopeText = section(issue.body, SCOPE_HEADINGS);
  const criteriaText = section(issue.body, CRITERIA_HEADINGS);
  return {
    issue,
    scopes: scopeText === undefined
      ? undefined
      : items(scopeText).map(toPattern).filter((p): p is string => p !== undefined),
    criteria: criteriaText === undefined ? undefined : items(criteriaText),
    allowOverlap: ALLOW_OVERLAP.test(issue.body),
  };
}
