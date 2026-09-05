# ログイン画面を追加する

## 対象範囲

- `src/auth/**`
- `src/routes/login.tsx`

## 受け入れ条件

- 未登録のメールで送信すると 401 と `USER_NOT_FOUND` が返る
- パスワードが8文字未満のとき、送信ボタンが `disabled` になる
- `npm test -- auth` が通る
