import { app, BrowserWindow, shell, ipcMain, safeStorage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, getDatabase } from './db/schema'
import { TaskService } from './services/TaskService'
import { TerminalService } from './services/TerminalService'
import { GitService } from './services/GitService'
import { ClaudeService } from './services/ClaudeService'
import { DevServerService } from './services/DevServerService'
import { registerTaskHandlers } from './ipc/tasks'
import { registerTerminalHandlers } from './ipc/terminal'
import { registerGitHandlers } from './ipc/git'
import { registerClaudeHandlers } from './ipc/claude'
import { registerDevServerHandlers } from './ipc/devServer'
import type { AppSettings } from '../../src/types/ipc'

let mainWindow: BrowserWindow | null = null
let devServerServiceInstance: DevServerService | null = null
let terminalServiceInstance: TerminalService | null = null

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

  // Initialize services
  const taskService = new TaskService(db)
  const terminalService = new TerminalService()
  terminalServiceInstance = terminalService
  const gitService = new GitService()
  const claudeService = new ClaudeService(terminalService)
  const devServerService = new DevServerService()
  devServerServiceInstance = devServerService

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

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  devServerServiceInstance?.stopAll()
  terminalServiceInstance?.killAll()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})
