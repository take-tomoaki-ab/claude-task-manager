# create-release

リリースタグの作成・push・GitHubリリース公開を一括で行うスキル。

## 使い方

```
/create-release v1.2.0
```

バージョンを省略した場合はユーザーに確認する。

## 手順

1. 直前のタグを取得する：
   ```
   git tag --list --sort=-v:refname | head -1
   ```

2. **タグ作成前に** `HEAD` を使ってコミット一覧を取得する（新タグはまだ存在しないため）：
   ```
   git log <前タグ>..HEAD --oneline
   ```

3. コミットメッセージのプレフィックスでセクションに振り分ける：
   - `feat:` → **Features**
   - `fix:` → **Bug Fixes**
   - `docs:` → **Documentation**
   - `chore:` / `refactor:` / `perf:` / `ci:` などは **Other Changes** セクションにまとめる
   - 該当コミットがないセクションは丸ごと省略する
   - リリースノートに書く内容は **`feat:` などのプレフィックスを除いた本文のみ**（例: `feat: ダークモード対応` → `ダークモード対応`）
   - コミットハッシュはリリースノートに含めない
   - セクション内の順序は `git log` の出現順（新しいコミットが上）のままとする

4. `.claude/skills/create-release/RELEASE_TEMPLATE.md` のフォーマットに従ってリリースノートを組み立てる。
   `PREV_TAG` と `NEXT_TAG` を実際のタグ名に置き換える。
   テンプレートにあっても該当コミットのないセクションは省略する。

5. タグを作成してリモートに push する：
   ```
   git tag <新タグ>
   git push origin <新タグ>
   ```
   タグが既に存在する場合は `git tag` をスキップしてそのまま次へ進む。

6. リリースノートを `/tmp/release_notes_<タグ>.md` に書き出し、`gh` コマンドでリリースを作成する：
   ```
   gh release create <タグ> --title "<タグ>" --notes-file /tmp/release_notes_<タグ>.md
   ```

7. 作成されたリリースの URL を返す（`gh release create` の標準出力にそのまま含まれる）。`/tmp/release_notes_<タグ>.md` を削除する。
