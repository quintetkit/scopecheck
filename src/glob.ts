/**
 * Issue の対象範囲に書くパターンの照合。
 *
 * 依存を足さずに済ませたいので、必要な範囲だけを自前で持つ。
 * 対応するのは `**` `*` `?` と、ワイルドカードを含まないパスの前方一致だけ。
 * `{a,b}` や否定は入れていない。**書けるものを増やすほど、
 * 「当たっているつもりで当たっていない」パターンが増える**ため。
 */

/** 正規表現のメタ文字を無効化する。`*` と `?` はこのあとで扱うので残す。 */
const escape = (s: string): string => s.replace(/[.+^${}()|[\]\\]/g, "\\$&");

/**
 * glob を正規表現へ。
 *
 *   src/**      → src/ 以下すべて
 *   src/*.ts    → src 直下の .ts だけ（src/a/b.ts は当たらない）
 *   ** /*.ts    → 深さを問わず .ts
 *   ?           → 1文字。ただし / は跨がない
 */
export function toRegExp(pattern: string): RegExp {
  const p = pattern.replace(/^\.\//, "").replace(/\/+$/, "/**");
  let out = "";
  let i = 0;
  while (i < p.length) {
    const two = p.slice(i, i + 2);
    if (two === "**") {
      // `**/` は「0 個以上のディレクトリ」。末尾の `**` は残り全部
      if (p.slice(i + 2, i + 3) === "/") {
        out += "(?:[^/]+/)*";
        i += 3;
      } else {
        out += ".*";
        i += 2;
      }
      continue;
    }
    const c = p[i];
    if (c === "*") out += "[^/]*";
    else if (c === "?") out += "[^/]";
    else out += escape(c);
    i += 1;
  }
  return new RegExp(`^${out}$`);
}

const hasWildcard = (pattern: string): boolean => /[*?]/.test(pattern);

/**
 * パターンに当たるファイルを返す。
 *
 * ワイルドカードの無いパターンは、そのファイル自身と、その配下の両方に当てる。
 * `src/auth` と書いた人は `src/auth/` 以下を指しているのが普通なので。
 */
export function match(pattern: string, files: readonly string[]): string[] {
  const p = pattern.replace(/^\.\//, "").replace(/\/+$/, "");
  if (!hasWildcard(p)) {
    const prefix = `${p}/`;
    return files.filter((f) => f === p || f.startsWith(prefix));
  }
  const re = toRegExp(pattern);
  return files.filter((f) => re.test(f));
}

/** 複数パターンの和集合。順序は files の順を保つ。 */
export function matchAll(patterns: readonly string[], files: readonly string[]): Set<string> {
  const hit = new Set<string>();
  for (const p of patterns) for (const f of match(p, files)) hit.add(f);
  return hit;
}
