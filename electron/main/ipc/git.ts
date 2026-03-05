import { ipcMain } from 'electron'
import type { GitService } from '../services/GitService'
import { expandPath } from '../utils/path'

export function registerGitHandlers(gitService: GitService): void {
  ipcMain.handle('git:status', async (_, workdir: string) => {
    try {
      return await gitService.status(expandPath(workdir))
    } catch (error) {
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        modified: 0,
        error: (error as Error).message
      }
    }
  })

  ipcMain.handle('git:branches', async (_, workdir: string) => {
    return await gitService.branches(expandPath(workdir))
  })
}
