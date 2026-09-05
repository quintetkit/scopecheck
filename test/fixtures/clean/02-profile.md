# プロフィール編集

## 対象範囲

- `src/profile/**`

## 受け入れ条件

- 表示名を空で保存すると 422 が返り、`name is required` が表示される
- `npm test -- profile` が通る
