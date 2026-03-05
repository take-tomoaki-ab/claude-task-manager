import { app, BrowserWindow, shell, ipcMain, safeStorage, protocol, dialog } from 'electron'
import { join, extname } from 'path'
import { readdirSync, readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, getDatabase } from './db/schema'
import { TaskService } from './services/TaskService'
import { TerminalService } from './services/TerminalService'
import { GitService } from './services/GitService'
import { ClaudeService } from './services/ClaudeService'
import { DevServerService } from './services/DevServerService'
import { GitHubService } from './services/GitHubService'
import { registerTaskHandlers } from './ipc/tasks'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerGitHandlers } from './ipc/git'
import { registerClaudeHandlers } from './ipc/claude'
import { registerDevServerHandlers } from './ipc/devServer'
import { registerGitHubHandlers, syncReviewPRs } from './ipc/github'
import type { AppSettings } from '../../src/types/ipc'

// bg:// カスタムプロトコルをセキュアとして登録（app.whenReady より前に必要）
protocol.registerSchemesAsPrivileged([
  { scheme: 'bg', privileges: { secure: true, standard: true, supportFetchAPI: true } }
])

let mainWindow: BrowserWindow | null = null
let devServerServiceInstance: DevServerService | null = null
let terminalServiceInstance: TerminalService | null = null
let prSyncTimerId: ReturnType<typeof setInterval> | null = null

function getWindow(): BrowserWindow | null {
  return mainWindow
}

function getSettings(): AppSettings {
  const db = getDatabase()
  const row = db.prepare(`SELECT value FROM app_settings WHERE key = ?`).get('settings') as
    | { value: string }
    | undefined

  if (!row) {
    return { panes: [] }
  }

  const settings = JSON.parse(row.value) as AppSettings

  // Decrypt GitHub PAT if exists
  if (settings.githubPat && safeStorage.isEncryptionAvailable()) {
    try {
      const encrypted = Buffer.from(settings.githubPat, 'base64')
      settings.githubPat = safeStorage.decryptString(encrypted)
    } catch {
      // Decryption failed, return as-is
    }
  }

  return settings
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.claude-task-manager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  const db = initDatabase()

  // 起動時にdoingタスクをwill_doに戻す（再起動でPTYセッションが消えるため）
  db.prepare(`UPDATE tasks SET status = 'will_do' WHERE status = 'doing'`).run()
  db.prepare(`DELETE FROM task_runtime`).run()

  // Initialize services
  const taskService = new TaskService(db)
  const terminalService = new TerminalService()
  terminalServiceInstance = terminalService
  const gitService = new GitService()
  const claudeService = new ClaudeService(terminalService)
  const devServerService = new DevServerService()
  devServerServiceInstance = devServerService
  const gitHubService = new GitHubService()

  // Register IPC handlers
  registerTaskHandlers(taskService)
  registerTerminalHandlers(terminalService, getWindow)
  registerGitHandlers(gitService)
  registerClaudeHandlers(
    claudeService,
    taskService,
    gitService,
    terminalService,
    getWindow,
    getSettings
  )
  registerDevServerHandlers(devServerService, getWindow, getSettings)
  registerGitHubHandlers(gitHubService, taskService, getSettings)

  // PR自動同期タイマー（1分ごとにチェックし、設定された間隔で同期を実行）
  let lastPrSyncAt = 0
  prSyncTimerId = setInterval(async () => {
    const s = getSettings()
    const intervalMs = (s.githubPrSyncIntervalMin ?? 5) * 60 * 1000
    const now = Date.now()
    if (now - lastPrSyncAt >= intervalMs) {
      lastPrSyncAt = now
      try {
        await syncReviewPRs(gitHubService, taskService, getSettings)
      } catch (err) {
        console.error('[github:sync-prs] auto-sync error:', err)
      }
    }
  }, 60_000)

  // Settings handlers
  ipcMain.handle('settings:get', async () => {
    return getSettings()
  })

  ipcMain.handle('settings:set', async (_, settings: Partial<AppSettings>) => {
    try {
      const current = getSettings()
      const merged = { ...current, ...settings }

      // Encrypt GitHub PAT
      if (merged.githubPat && safeStorage.isEncryptionAvailable()) {
        merged.githubPat = safeStorage
          .encryptString(merged.githubPat)
          .toString('base64')
      }

      db.prepare(
        `INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)`
      ).run('settings', JSON.stringify(merged))
    } catch (error) {
      throw new Error(`Failed to save settings: ${(error as Error).message}`)
    }
  })

  // Shell handler
  ipcMain.handle('shell:open-external', async (_, url: string) => {
    await shell.openExternal(url)
  })

  // 画像ファイル一覧取得
  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp'])
  ipcMain.handle('shell:list-images', async (_, dir: string): Promise<string[]> => {
    try {
      return readdirSync(dir)
        .filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()))
        .map((f) => join(dir, f))
    } catch {
      return []
    }
  })

  // ディレクトリ選択ダイアログ
  ipcMain.handle('dialog:open-directory', async (): Promise<string | null> => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    })
    return result.canceled ? null : result.filePaths[0]
  })

  // bg:// プロトコル → ローカル画像ファイルを直接読んで返す
  const MIME_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.bmp': 'image/bmp',
  }
  protocol.handle('bg', (request) => {
    try {
      // bg://local?path=/Users/... 形式でパスを受け取る
      const filePath = new URL(request.url).searchParams.get('path') ?? ''
      const data = readFileSync(filePath)
      const contentType = MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
      return new Response(data, { headers: { 'Content-Type': contentType } })
    } catch (e) {
      console.error('[bg] error:', e)
      return new Response('Not Found', { status: 404 })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (prSyncTimerId) clearInterval(prSyncTimerId)
  devServerServiceInstance?.stopAll()
  terminalServiceInstance?.killAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
