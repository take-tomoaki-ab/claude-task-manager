# Claude Task Manager

Claude Code の並列開発を管理するElectronデスクトップダッシュボード。

---

## 開発ルール

- **作業完了後は必ずコミットする**: ファイルを変更・追加したら、作業の最後に `git add` + `git commit` を実行する。コミットメッセージは変更内容を端的に表す日本語または英語で記述する。

---

## 技術スタック

| 用途 | 技術 |
|---|---|
| デスクトップシェル | Electron 28 + electron-vite |
| UI | React 18 + TypeScript |
| スタイリング | Tailwind CSS |
| 状態管理 | Zustand |
| ローカルDB | better-sqlite3 (SQLite) |
| ターミナル | node-pty + @xterm/xterm |
| Git操作 | simple-git |
| ルーティング | react-router-dom v6 |

---

## ディレクトリ構造

```
electron/
  main/
    index.ts              # Electronエントリ・bg://プロトコル・settings/shell/dialog IPC
    db/schema.ts          # DB初期化・マイグレーション
    services/
      TaskService.ts      # タスクCRUD・アーカイブ
      TerminalService.ts  # node-pty管理 (Map<taskId, IPty>)
      GitService.ts       # simple-git ラッパー
      ClaudeService.ts    # claude起動・コンテキスト解析・通知
      DevServerService.ts # 開発サーバーspawn管理
    ipc/
      tasks.ts / terminal.ts / git.ts / claude.ts / devServer.ts
    utils/path.ts         # パスユーティリティ
  preload/index.ts        # contextBridge でwindow.api公開
src/
  types/
    task.ts               # Task, RuntimeTask, ArchiveEntry 型
    ipc.ts                # AppSettings, WindowApi, IpcChannels 型
    window.d.ts           # window.api の型宣言
  stores/
    taskStore.ts          # Zustand (tasks, filteredTasks, CRUD actions)
    terminalStore.ts      # Zustand (isOpen, activeTaskId)
  components/
    BackgroundSlideshow/  # 背景スライドショー（bg://プロトコル使用）
    BranchStatus/         # ブランチ状態表示（5秒ポーリング）
    Common/               # ConfirmDialog, ConflictWarningModal
    ContextMeter/         # コンテキスト使用量プログレスバー
    FilterBar/            # 検索・タイプフィルタ・新規タスクボタン
    PaneStatusSidebar/    # ペイン状態・開発サーバー起動停止
    TaskCard/             # タスクカード (PRStatusBadge含む)
    TaskForm/             # タスク作成・編集モーダル
    Terminal/             # xterm.jsターミナルパネル
  pages/
    DashboardPage.tsx     # 3カラムKanbanボード
    ArchivePage.tsx       # アーカイブ一覧
    SettingsPage.tsx      # 設定画面
  App.tsx / main.tsx
```

---

## 実装済み機能

### タスク管理

- **6タイプのタスク作成・編集**
  - `feat`: タイトル / ブランチ* / Wrikeチケット* / プロンプト*
  - `design`: タイトル / 出力パス* / プロンプト
  - `review`: タイトル / PR URL* / プロンプト
  - `qa`: タイトル / ブランチ* / Wrikeチケット* / プロンプト
  - `research`: タイトル / ブランチ* / プロンプト*
  - `chore`: タイトル / ディレクトリ* / プロンプト
- **編集**: タイプ以外の全フィールドを編集可能
- **削除**: タスクの完全削除
- **アーカイブ**: 完了タスクをアーカイブへ移動
- **3カラムKanban**: `will_do` / `doing` / `done`
- **依存タスク**: 依存先が未完了なら開始をブロック（ホバーでツールチップ）
- **完了タイムスタンプ**: doneタスクに完了日時を表示
- **即時完了ボタン**: will_doカードでも「完了」ボタンで実行なしに完了へ移行可能

### タスク実行・ターミナル

- **タスク開始**:
  - ペイン自動割り当て（最初の空きペイン）
  - 対象ブランチへの自動チェックアウト（feat / qa / research）
  - Claude Code の自動起動（2秒後にプロンプト注入）
  - 依存タスク未完了・空きペインなしの場合はボタン無効化
- **ペイン競合検出**: 同一ペインに実行中タスクがあれば警告モーダル（強制起動も可）
- **タスク完了**: 完了ボタンでステータス変更 + ターミナルセッション自動クローズ
- **再起動時自動リセット**: 起動時にdoingタスクをwill_doに戻し、task_runtimeをクリア
- **インタラクティブターミナル**: 右480pxスライドパネル
  - xterm.jsによる個別PTYセッション
  - パネルを閉じてもPTYプロセスは維持（バックグラウンド継続）
  - ResizeObserverによる自動リサイズ追従

### Claude Code 連携

- **起動モード切り替え**:
  - 通常: `claude`
  - 危険モード: `claude --dangerously-skip-permissions`（設定で有効化）
- **プロンプト注入**: タスク固有prompt → 設定テンプレート の優先順で適用
- **プロンプトテンプレート変数**: `{title}` は全タイプ共通、各タイプ固有変数あり
  - feat: `{branch}` `{ticket}` `{prompt}`
  - design: `{output}`
  - review: `{pr-url}`
  - qa: `{branch}` `{ticket}`
  - research: `{branch}` `{prompt}`
  - chore: `{directory}`

### Git 連携

- **ブランチ状態表示**（5秒ポーリング）: ブランチ名 / ahead(↑緑) / behind(↓赤) / 未コミット変更数(黄)
- **自動ブランチチェックアウト**: タスク開始時に指定ブランチを作成/切り替え
- **PRステータスバッジ**: review タスクで `open` / `merged` / `closed` をリアルタイム表示
- **外部リンク**: WrikeチケットおよびGitHub PRをブラウザで開く

### コンテキストウィンドウ管理

- **トークン使用量表示**: `75,234 / 200,000 tokens` 形式
- **プログレスバー**: 緑(0〜80%) / 黄(80〜90%) / 赤(90%〜)
- **デスクトップ通知**: 80%到達時 / 90%到達時 / タスク完了時

### ペイン・開発サーバー

- **ペインステータスサイドバー（左192px）**: ペインID / パス / 占有状況
- **開発サーバー制御**: ペインごとに複数サーバーを起動/停止
  - ●実行中（緑）/ ○停止中（灰）のステータス表示
  - ターミナルパネルでリアルタイムログ閲覧（1秒ポーリング）
- **空きペイン検出**: タスク開始時に自動選択

### 検索・フィルタ

- **全文検索**: タイトル / ブランチ / チケット / URLを横断検索
- **タイプフィルタ**: チェックボックスで絞り込み
- **カラム件数表示**: 各ステータスのタスク数を表示

### アーカイブ

- アーカイブページ（`/archive`）で過去のタスクを時系列表示
- 展開してタイプ・ブランチ・チケット・プロンプト・日時を確認
- 確認ダイアログ付きで個別削除

### 背景画像スライドショー

- 指定ディレクトリ内の画像（jpg/jpeg/png/gif/webp/avif/bmp）をランダムにクロスフェード表示
- `bg://local?path=...` カスタムElectronプロトコルでローカル画像を安全に配信
- 切替間隔（秒）を設定画面で変更可能（デフォルト30秒）
- 設定画面のフォルダ選択ダイアログで画像ディレクトリを選択

---

## 設定項目（AppSettings）

| フィールド | 説明 |
|---|---|
| `panes` | PaneConfig[] - ID / 絶対パス / devServers |
| `githubPat` | GitHub PAT（safeStorageで暗号化保存） |
| `useDangerouslySkipPermissions` | claude起動時に`--dangerously-skip-permissions`を付加 |
| `promptTemplates` | タスクタイプ別プロンプトテンプレート |
| `backgroundImageDir` | 背景スライドショー画像ディレクトリ |
| `backgroundIntervalSec` | スライドショー切替間隔（秒） |

---

## 重要な設計決定

- **pane競合**: 同一paneのdoingタスク存在時はIPCエラーコード `PANE_CONFLICT` を返却
- **worktree不使用**: 固定ディレクトリにpaneをマッピングし、`git checkout` でブランチ切り替え
- **DBファイル**: `app.getPath('userData')` に保存
- **GitHub PAT**: `safeStorage.encryptString` で暗号化してDB保存
- **PTY管理**: `Map<taskId, IPty>` でセッションをライフサイクル全体で維持
- **コンテキスト解析**: node-pty stdout/stderrをリアルタイムパース（失敗時はメーター非表示）
- **bg://プロトコル**: `protocol.registerSchemesAsPrivileged` で`app.whenReady`より前に登録必要
- **再起動時クリーンアップ**: 起動直後にdoing→will_do変換 + task_runtimeテーブル全削除
