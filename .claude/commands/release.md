# リリース作成スキル

引数としてリリースバージョン（例: `v1.2.0`）を受け取る。省略時はユーザーに確認する。

## 手順

1. 直前のタグを `git tag --list --sort=-v:refname | head -1` で取得する
2. `git log <前タグ>..<新タグ> --oneline` でコミット一覧を取得する
3. コミットメッセージのプレフィックスでセクションに振り分ける：
   - `feat:` → Features
   - `fix:` → Bug Fixes
   - `docs:` → Documentation
   - `refactor:` / `chore:` / `perf:` などはその内容で適切なセクションに入れる
   - 該当コミットがないセクションは省略する
4. `.github/RELEASE_TEMPLATE.md` のフォーマットに従ってリリースノートを組み立てる
5. `$PREV_TAG` と `$NEXT_TAG` を実際のタグ名に置き換える
6. タグがまだ存在しなければ作成し、リモートにpushする
7. `gh release create <タグ> --title "<タグ>" --notes "<リリースノート>"` でリリースを作成する
8. 作成されたリリースのURLを返す
