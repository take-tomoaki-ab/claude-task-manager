import { ipcMain, type BrowserWindow } from 'electron'
import type { DevServerService } from '../services/DevServerService'
import type { AppSettings } from '../../../src/types/ipc'

export function registerDevServerHandlers(
  devServerService: DevServerService,
  getWindow: () => BrowserWindow | null,
  getSettings: () => AppSettings
): void {
  devServerService.onStatusChange((statuses) => {
    const win = getWindow()
    if (win && !win.isDestroyed()) {
      win.webContents.send('devserver:status-change', statuses)
    }
  })

  ipcMain.handle(
    'devserver:start',
    async (_, { repoId, paneId, label }: { repoId: string; paneId: string; label: string }) => {
      try {
        const settings = getSettings()
        const repo = settings.repos.find((r) => r.id === repoId)
        if (!repo) {
          throw new Error(`Repo not found: ${repoId}`)
        }
        const paneConfig = repo.panes.find((p) => p.id === paneId)
        if (!paneConfig) {
          throw new Error(`Pane not found: ${paneId} in repo ${repoId}`)
        }

        const serverConfig = paneConfig.devServers.find((s) => s.label === label)
        if (!serverConfig) {
          throw new Error(`Dev server not found: ${label} in pane ${paneId}`)
        }

        devServerService.start(repoId, paneConfig, serverConfig)
      } catch (error) {
        throw new Error(`Failed to start dev server: ${(error as Error).message}`)
      }
    }
  )

  ipcMain.handle(
    'devserver:stop',
    async (_, { repoId, paneId, label }: { repoId: string; paneId: string; label: string }) => {
      try {
        devServerService.stop(repoId, paneId, label)
      } catch (error) {
        throw new Error(`Failed to stop dev server: ${(error as Error).message}`)
      }
    }
  )

  ipcMain.handle('devserver:status', async () => {
    return devServerService.status()
  })

  ipcMain.handle(
    'devserver:log',
    async (_, { repoId, paneId, label }: { repoId: string; paneId: string; label: string }) => {
      return devServerService.getLog(repoId, paneId, label)
    }
  )
}
