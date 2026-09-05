# scopecheck

**開いている Issue を、同時に走らせて安全か検査します。**

各 Issue が宣言している対象範囲のパターンを実ファイルへ展開し、
**具体的なファイル単位で重なっている組**を報告します。

```
$ scopecheck --repo acme/api

error #12 ✕ #14
      対象範囲が重なっています。この2つを同時に走らせると、
      あとから出す方が必ずコンフリクトします。
        src/types.ts
        src/routes/index.ts
      scope-overlap

warn  #17 レート制限を入れる
      どのファイルにも当たらないパターンがあります。
      打ち間違いか、すでに消えたパスの可能性があります。
        src/middleware/**
      scope-unmatched

error 1 件 / warn 1 件（Issue 7 件を検査）
```

## なぜ要るのか

並列化が失敗する理由は、たいてい地味です。**タスクが実は独立していない。**
2つが共有ファイル（ルーティング定義、型定義の集約、DI コンテナ）を触っていて、
**あとからマージする方がやり直しになる。**

Issue が3つなら目で見て気づけます。15 になると無理です。
**宣言は Issue に書いてあるのに、それを突き合わせる仕組みが無い**のが問題でした。

## 導入

Node 22.6 以降（ビルド不要でそのまま .ts を実行します）と、
GitHub から Issue を読むなら [`gh`](https://cli.github.com/) が要ります。

```bash
git clone https://github.com/quintetkit/scopecheck
node scopecheck/src/cli.ts --repo owner/name
```

## 使い方

```bash
# リポジトリの open な Issue を検査
scopecheck --repo owner/name

# 出す前の下書き（1ファイル1 Issue）を検査
scopecheck --dir drafts/

# CI で
scopecheck --repo owner/name --format github --strict
```

照合に使うファイル一覧は **`git ls-files`** から取ります（`--root` で指定、既定はカレント）。
**ビルド成果物や無視されているファイルを重なりとして数えない**ためです。

## 検査するもの

| ルール | 深刻度 | 内容 |
|---|---|---|
| `scope-overlap` | error | 2つの Issue が同じファイルを含む。**ファイル名を出します** |
| `scope-missing` | error | 対象範囲の節が無い。比べるものが無い |
| `scope-empty` | error | 節はあるがパスが書かれていない |
| `scope-unmatched` | warn | どのファイルにも当たらないパターン |
| `criteria-missing` | error | 受け入れ条件が無い。レビュアーが判定できない |
| `criteria-unverifiable` | warn | 具体的な値が1つも無い受け入れ条件 |

`criteria-unverifiable` は**意図的に狭く**してあります。
曖昧語があり、**かつ**コード・数字・引用が1つも無いときだけ報告します。
「正しく 401 を返す」は通り、「正しく動くこと」だけが引っかかります。

**誤検出を出す検査は、無いほうがマシ**だからです。

## Issue に必要なもの

対象範囲と受け入れ条件の見出し。日本語と英語のどちらでも認識します。

```markdown
## 対象範囲

- `src/auth/**`
- `src/routes/login.tsx`

## 受け入れ条件

- 未登録のメールで送信すると 401 と `USER_NOT_FOUND` が返る
- `npm test -- auth` が通る
```

パターンは `**` `*` `?` に対応します。
ワイルドカードが無いものは配下にも当たるので、`src/auth` は `src/auth/**` の意味です。

意図して共有する場合は、本文にこう書けば報告しません。

```markdown
<!-- scopecheck: allow-overlap -->
```

## 終了コード

| コード | 意味 |
|---|---|
| 0 | 指摘なし |
| 1 | error あり（`--strict` なら warn でも 1） |
| 2 | **検査できなかった** — ファイル一覧が空で、重なりを比べていない |

**2 があるのは意図的です。** リポジトリを見られなかった検査が、
見たうえで何も無かった検査と同じ 0 を返してはいけません。

## 実際のリポジトリで試した

このワークフローだけで作った CLI
[mdlinkcheck](https://github.com/quintetkit/mdlinkcheck) の Issue 11 件に掛けた結果:

```
5 error / 0 warning (11 issues checked)
```

**5組が同じファイルを宣言していました。** この5組は並列に走らせられません。
実際には1件ずつ進めたので事故は起きていませんが、
**それを事前に教えてくれるものは何も無かった**ということです。誤検出は0件でした。

## GitHub Actions

```yaml
- uses: quintetkit/scopecheck@v1
  with:
    repo: ${{ github.repository }}
```

## 関連

[Quartet](https://github.com/quintetkit/quartet) — Claude Code に設計・実装・
レビュー・コンフリクト解消を別々の人格として分担させる MIT の設定一式。
scopecheck は、そのワークフローが前提にしている
**「ファイルを共有する Issue は並列に走らせない」**を機械化したものです。

[ccheck](https://github.com/quintetkit/ccheck) — `.claude/` の設定を検査します。
指摘には必ず公式ドキュメントへの出典が付きます。

## ライセンス

MIT
