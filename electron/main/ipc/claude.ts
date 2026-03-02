import { ipcMain, type BrowserWindow } from 'electron'
import type { ClaudeService } from '../services/ClaudeService'
import type { TaskService } from '../services/TaskService'
import type { GitService } from '../services/GitService'
import type { TerminalService } from '../services/TerminalService'
import type { AppSettings } from '../../../src/types/ipc'

export function registerClaudeHandlers(
  claudeService: ClaudeService,
  taskService: TaskService,
  gitService: GitService,
  terminalService: TerminalService,
  getWindow: () => BrowserWindow | null,
  getSettings: () => AppSettings
): void {
  ipcMain.handle(
    'claude:start',
    async (
      _,
      { taskId, workdir, prompt }: { taskId: string; workdir: string; prompt?: string }
    ) => {
      try {
        const tasks = taskService.list()
        const task = tasks.find((t) => t.id === taskId)
        if (!task) {
          throw new Error(`Task not found: ${taskId}`)
        }

        // Update status to doing
        taskService.update(taskId, { status: 'doing' })

        // Determine workdir from pane config or task fields
        const settings = getSettings()
        let resolvedWorkdir = workdir

        if (task.type === 'chore' && 'directory' in task) {
          resolvedWorkdir = task.directory
        } else if (!resolvedWorkdir) {
          const paneConfig = settings.panes.find((p) => p.id === task.pane)
          if (paneConfig) {
            resolvedWorkdir = paneConfig.path
          }
        }

        // Check for branch checkout
        if ('branch' in task && task.branch) {
          await gitService.checkout(resolvedWorkdir, task.branch)
        }

        // Check if another doing task exists on the same pane
        const conflicting = tasks.find(
          (t) => t.id !== taskId && t.pane === task.pane && t.status === 'doing'
        )
        if (conflicting) {
          throw new Error(
            `PANE_CONFLICT: Another task "${conflicting.title}" is already running on pane "${task.pane}"`
          )
        }

        // Start Claude
        const taskPrompt = prompt || task.prompt
        claudeService.start(taskId, resolvedWorkdir, taskPrompt)

        // Record PID
        const pid = terminalService.getPid(taskId)
        if (pid) {
          taskService.update(taskId, { pid, workdir: resolvedWorkdir })
        }

        // Set up context update forwarding
        claudeService.onContextUpdate((info) => {
          if (info.taskId === taskId) {
            taskService.update(taskId, {
              contextUsed: info.used,
              contextLimit: info.limit
            })
            const win = getWindow()
            if (win && !win.isDestroyed()) {
              win.webContents.send('claude:context-update', info)
            }
          }
        })
      } catch (error) {
        throw new Error(`Failed to start Claude: ${(error as Error).message}`)
      }
    }
  )
}
