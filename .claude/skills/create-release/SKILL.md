# create-release

リリースタグの作成・push・GitHubリリース公開を一括で行うスキル。

## 使い方

```
/create-release v1.2.0
```

バージョンを省略した場合はユーザーに確認する。

## 手順

1. 直前のタグを `git tag --list --sort=-v:refname | head -1` で取得する
2. `git log <前タグ>..<新タグ> --oneline` でコミット一覧を取得する
3. コミットメッセージのプレフィックスでセクションに振り分ける：
   - `feat:` → Features
   - `fix:` → Bug Fixes
   - `docs:` → Documentation
   - `refactor:` / `chore:` / `perf:` などはその内容に応じて適切なセクションに入れる
   - 該当コミットがないセクションは省略する
4. `RELEASE_TEMPLATE.md`（このファイルと同じディレクトリ）のフォーマットに従ってリリースノートを組み立てる
5. `$PREV_TAG` と `$NEXT_TAG` を実際のタグ名に置き換える
6. タグがまだ存在しなければ作成し、リモートにpushする
7. `gh release create <タグ> --title "<タグ>" --notes "<リリースノート>"` でリリースを作成する
8. 作成されたリリースのURLを返す
