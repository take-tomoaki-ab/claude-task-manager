# Claude Task Manager

Claude Code の並列開発を効率的に管理するデスクトップダッシュボード。

## 概要

複数の Claude Code セッションを同時に管理し、タスクの進捗をリアルタイムで把握するための Electron アプリ。

### 解決する課題

- 複数の Claude Code セッションを同時に管理する煩雑さ
- タスクの進捗をリアルタイムで把握する難しさ
- コンテキストウィンドウの枯渇による作業中断
- ブランチ・作業ディレクトリの状態把握

## 技術スタック

| 用途 | 技術 |
|---|---|
| デスクトップシェル | Electron 28 |
| UI | React 18 + TypeScript |
| ビルド | electron-vite |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| ローカル DB | better-sqlite3 |
| ターミナル | node-pty + @xterm/xterm |
| Git 操作 | simple-git |
| 通知 | Electron Notification API |

## セットアップ

```bash
# 依存関係インストール
npm install

# ネイティブモジュールのリビルド（必須）
# better-sqlite3 / node-pty をElectronのNode.jsバージョン向けに再コンパイル
npm run rebuild
```

## 開発

```bash
npm run dev
```

## ビルド

```bash
npm run build
npm run start
```

## 機能

### タスク管理

6種類のタスクタイプに対応した起票フォーム：

| タイプ | 用途 | フィールド |
|---|---|---|
| `feat` | 機能開発 | branch, 分岐元ブランチ, Wrike ticket URL, prompt |
| `design` | 設計 | output 先パス |
| `review` | PR レビュー | GitHub PR URL |
| `bugfix` | バグ修正 | branch, 分岐元ブランチ, Wrike ticket URL |
| `research` | 調査 | branch, prompt |
| `chore` | 雑務 | 作業ディレクトリ |

タスクは `will_do → doing → done` の 3 ステータスで管理。

### タスク実行

「開始」ボタンで Claude Code を自動起動：

1. pane マッピングから作業ディレクトリを解決
2. `git checkout <branch>` で対象ブランチに切り替え
3. 指定ディレクトリで `claude` コマンドを起動
4. prompt があれば初期メッセージを自動入力

同一 pane で他のタスクが実行中の場合は競合警告を表示。

### ターミナル統合

実行中タスクの「対話を開く」から右スライドパネルで Claude Code セッションに接続。複数タスクを切り替えてもセッションはバックグラウンドで維持。

### コンテキスト監視

Claude Code の出力をリアルタイムでパースしてコンテキスト使用量を表示：

- ～79%: 緑
- 80～89%: 黄（デスクトップ通知）
- 90%～: 赤（デスクトップ通知）

### ブランチステータス

5 秒間隔でポーリングし、実行中タスクの作業ディレクトリの git 状態を表示：

```
feature-name  ↑2 ↓0  (未コミット: 3ファイル)
```

### 開発サーバー管理

左サイドバーから pane ごとの開発サーバーを起動・停止。クリック 1 回でトグル。

### GitHub PR 自動同期

GitHub API でレビュー依頼されている PR を定期取得し、未起票のものを `review` タスクとして自動作成。

- 同期間隔は設定画面で変更可能（デフォルト 5 分）
- 手動で「今すぐ同期」ボタンから即時実行も可能
- 重複タスク・アーカイブ済みのものは自動スキップ

### アーカイブ

完了タスクをアーカイブしてダッシュボードを整理。`/archive` 画面で過去のタスクを参照・削除。

## 設定

### GUI から設定する

初回起動後、右上の「設定」から各項目を入力：

1. **pane マッピング**：pane ID と対応するリポジトリの絶対パスを設定
   ```
   p1  →  /Users/yourname/projects/my-app
   p2  →  /Users/yourname/projects/another-worktree
   ```
2. **開発サーバー**：各 pane で起動可能なサーバーコマンドを設定
3. **GitHub PAT**：PR ステータスバッジ表示・PR 自動同期用（`safeStorage` で暗号化保存）
4. **GitHub ユーザー名 + 同期間隔**：PR 自動同期の設定

### 設定ファイル（JSON）でまとめて設定する

設定画面の **「JSONをインポート」** ボタンから `settings.example.json` を参考に作成した JSON ファイルを読み込むことで、全設定を一括適用できます。

**① `settings.example.json` をコピーして編集**

```bash
cp settings.example.json my-settings.json
```

```json
{
  "panes": [
    {
      "id": "p1",
      "path": "/Users/yourname/projects/my-app",
      "devServers": [
        {
          "label": "Dev",
          "command": "npm",
          "args": ["run", "dev"],
          "port": 3000
        },
        {
          "label": "Storybook",
          "command": "npm",
          "args": ["run", "storybook"],
          "port": 6006
        }
      ]
    },
    {
      "id": "p2",
      "path": "/Users/yourname/projects/another-project",
      "devServers": []
    }
  ],
  "githubPat": "ghp_xxxxxxxxxxxxxxxxxxxx",
  "githubUsername": "your-github-username",
  "githubPrSyncIntervalMin": 5,
  "useDangerouslySkipPermissions": false,
  "promptTemplates": {
    "feat": "以下のタスクを実装してください。\n\nタイトル: {title}\nブランチ: {branch}\nチケット: {ticket}\n\n{prompt}",
    "design": "以下の設計書を作成してください。\n\nタイトル: {title}\n出力先: {output}",
    "review": "以下のPRをレビューしてください。\n\nタイトル: {title}\nPR URL: {pr-url}\n\nコードの品質・バグ・セキュリティの観点でレビューしてください。",
    "bugfix": "以下のバグを修正してください。\n\nタイトル: {title}\nブランチ: {branch}\nチケット: {ticket}",
    "research": "以下のテーマを調査してください。\n\nタイトル: {title}\nブランチ: {branch}\n\n{prompt}",
    "chore": "以下の作業を実施してください。\n\nタイトル: {title}\nディレクトリ: {directory}"
  },
  "backgroundImageDir": "/Users/yourname/Pictures/wallpapers",
  "backgroundIntervalSec": 30
}
```

**② 設定画面でインポート**

設定画面右上の「JSONをインポート」ボタンをクリック → 作成した JSON ファイルを選択 → 「保存」で完了。

**③ 設定のエクスポート（バックアップ）**

「JSONをエクスポート」ボタンから現在の設定を JSON ファイルとして書き出せます（GitHub PAT はセキュリティのため除外されます）。

### 設定項目一覧

| フィールド | 型 | 説明 |
|---|---|---|
| `panes` | `PaneConfig[]` | pane ID / 絶対パス / 開発サーバー設定 |
| `panes[].id` | `string` | pane 識別子（例: `"p1"`） |
| `panes[].path` | `string` | 作業ディレクトリの絶対パス |
| `panes[].devServers` | `DevServer[]` | 開発サーバー定義（label / command / args / port） |
| `githubPat` | `string` | GitHub Personal Access Token（暗号化保存） |
| `githubUsername` | `string` | GitHub ユーザー名（PR 自動同期用） |
| `githubPrSyncIntervalMin` | `number` | PR 自動同期間隔（分、デフォルト `5`） |
| `useDangerouslySkipPermissions` | `boolean` | `claude --dangerously-skip-permissions` で起動（デフォルト `false`） |
| `promptTemplates` | `object` | タスクタイプ別の初期プロンプトテンプレート |
| `backgroundImageDir` | `string` | 背景スライドショー用の画像ディレクトリ絶対パス |
| `backgroundIntervalSec` | `number` | スライドショー切替間隔（秒、デフォルト `30`） |

### プロンプトテンプレート変数

`promptTemplates` 内で使用できる変数：

| 変数 | 対応タイプ | 内容 |
|---|---|---|
| `{title}` | 全タイプ | タスクタイトル |
| `{branch}` | feat / bugfix / research | ブランチ名 |
| `{ticket}` | feat / bugfix | Wrike チケット URL |
| `{prompt}` | feat / research | タスク固有のプロンプト |
| `{output}` | design | 出力先パス |
| `{pr-url}` | review | GitHub PR URL |
| `{directory}` | chore | 作業ディレクトリ |

## ディレクトリ構造

```
├── electron/
│   ├── main/
│   │   ├── index.ts              # Electron エントリポイント
│   │   ├── db/schema.ts          # SQLite スキーマ
│   │   ├── services/             # ビジネスロジック
│   │   └── ipc/                  # IPC ハンドラ
│   └── preload/index.ts          # contextBridge API 公開
└── src/
    ├── components/               # UI コンポーネント
    ├── stores/                   # Zustand ストア
    ├── pages/                    # ページコンポーネント
    └── types/                    # 型定義
```
