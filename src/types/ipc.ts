import type { Task, RuntimeTask, ArchiveEntry, RuntimeTaskState, DistributiveOmit } from './task'

// pane設定
export type DevServerConfig = {
  label: string
  command: string
  args: string[]
  port?: number
}

export type PaneConfig = {
  id: string
  path: string
  devServers: DevServerConfig[]
}

// アプリ設定
export type AppSettings = {
  panes: PaneConfig[]
  githubPat?: string  // safeStorageで暗号化して保存
  githubUsername?: string  // GitHub ユーザー名（PR自動同期用）
  githubPrSyncIntervalMin?: number  // PR同期間隔（分、デフォルト5）
  useDangerouslySkipPermissions?: boolean  // claude --dangerously-skip-permissions で起動するか
  promptTemplates?: Record<string, string>  // タスクタイプ別プロンプトテンプレート
  backgroundImageDir?: string  // 背景画像ディレクトリ
  backgroundIntervalSec?: number  // スライドショー間隔（秒）
}

// Git status
export type GitStatusResult = {
  branch: string
  ahead: number
  behind: number
  modified: number
  error?: string
}

// Dev server status
export type DevServerStatus = {
  paneId: string
  label: string
  running: boolean
  pid?: number
  port?: number
}

// Terminal data event
export type TerminalDataEvent = {
  taskId: string
  data: string
}

// Context parsed from Claude output
export type ContextInfo = {
  taskId: string
  used: number
  limit: number
}

// IPC チャンネル定義（型安全のため）
export type IpcChannels = {
  // Tasks
  'tasks:list': [void, RuntimeTask[]]
  'tasks:create': [DistributiveOmit<Task, 'id' | 'created_at'>, RuntimeTask]
  'tasks:update': [{ id: string; data: Partial<Task & RuntimeTaskState> }, RuntimeTask]
  'tasks:delete': [string, void]
  'tasks:archive': [string, void]
  'tasks:list-archived': [void, ArchiveEntry[]]
  'tasks:delete-archived': [string, void]
  'tasks:archive-all-done': [void, number]
  'tasks:delete-all-archived': [void, number]
  'tasks:restore-archived': [string, RuntimeTask]

  // Terminal
  'terminal:start': [{ taskId: string; workdir: string }, void]
  'terminal:write': [{ taskId: string; data: string }, void]
  'terminal:kill': [string, void]
  'terminal:resize': [{ taskId: string; cols: number; rows: number }, void]

  // Git
  'git:status': [string, GitStatusResult]
  'git:branches': [string, string[]]

  // Claude
  'claude:start': [{ taskId: string; workdir: string; prompt?: string }, void]

  // Dev Server
  'devserver:start': [{ paneId: string; label: string }, void]
  'devserver:stop': [{ paneId: string; label: string }, void]
  'devserver:status': [void, DevServerStatus[]]
  'devserver:log': [{ paneId: string; label: string }, string]

  // Settings
  'settings:get': [void, AppSettings]
  'settings:set': [Partial<AppSettings>, void]
  'settings:export': [void, boolean]
  'settings:import': [void, AppSettings | null]

  // Shell
  'shell:open-external': [string, void]
  'shell:list-images': [string, string[]]

  // Dialog
  'dialog:open-directory': [void, string | null]

  // GitHub
  'github:sync-prs': [void, { created: number; total: number }]
}

// window.api の型定義（preload で expose するもの）
export type WindowApi = {
  tasks: {
    list: () => Promise<RuntimeTask[]>
    create: (task: DistributiveOmit<Task, 'id' | 'created_at'>) => Promise<RuntimeTask>
    update: (id: string, data: Partial<Task & RuntimeTaskState>) => Promise<RuntimeTask>
    delete: (id: string) => Promise<void>
    archive: (id: string) => Promise<void>
    listArchived: () => Promise<ArchiveEntry[]>
    deleteArchived: (id: string) => Promise<void>
    archiveAllDone: () => Promise<number>
    deleteAllArchived: () => Promise<number>
    restoreArchived: (id: string) => Promise<RuntimeTask>
  }
  terminal: {
    start: (taskId: string, workdir: string) => Promise<void>
    write: (taskId: string, data: string) => Promise<void>
    kill: (taskId: string) => Promise<void>
    resize: (taskId: string, cols: number, rows: number) => Promise<void>
    onData: (callback: (event: TerminalDataEvent) => void) => () => void
    offData: (taskId: string) => void
  }
  git: {
    status: (workdir: string) => Promise<GitStatusResult>
    branches: (workdir: string) => Promise<string[]>
  }
  claude: {
    start: (taskId: string, workdir: string, prompt?: string) => Promise<void>
    onContextUpdate: (callback: (info: ContextInfo) => void) => () => void
  }
  devserver: {
    start: (paneId: string, label: string) => Promise<void>
    stop: (paneId: string, label: string) => Promise<void>
    status: () => Promise<DevServerStatus[]>
    onStatusChange: (callback: (statuses: DevServerStatus[]) => void) => () => void
    getLog: (paneId: string, label: string) => Promise<string>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (settings: Partial<AppSettings>) => Promise<void>
    export: () => Promise<boolean>
    import: () => Promise<AppSettings | null>
  }
  shell: {
    openExternal: (url: string) => Promise<void>
    listImages: (dir: string) => Promise<string[]>
  }
  dialog: {
    openDirectory: () => Promise<string | null>
  }
  github: {
    syncPRs: () => Promise<{ created: number; total: number }>
  }
}
