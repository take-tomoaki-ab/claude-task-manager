import { ipcMain, type BrowserWindow } from 'electron'
import { expandPath } from '../utils/path'
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

        // Determine workdir from pane config or task fields
        const settings = getSettings()
        let resolvedWorkdir = workdir

        if (task.type === 'chore' && 'directory' in task) {
          resolvedWorkdir = expandPath(task.directory)
        } else if (!resolvedWorkdir) {
          const paneConfig = settings.panes.find((p) => p.id === task.pane)
          if (paneConfig) {
            resolvedWorkdir = expandPath(paneConfig.path)
          }
        } else {
          resolvedWorkdir = expandPath(resolvedWorkdir)
        }

        // Check if another doing task exists on the same pane
        const conflicting = tasks.find(
          (t) => t.id !== taskId && t.pane === task.pane && t.status === 'doing'
        )
        if (conflicting) {
          throw new Error('PANE_CONFLICT')
        }

        // Check for branch checkout（失敗してもステータスをdoingにしない）
        if ('branch' in task && task.branch) {
          await gitService.checkout(resolvedWorkdir, task.branch)
        }

        // 事前チェックが全て通ってからステータスをdoingに変更
        taskService.update(taskId, { status: 'doing' })

        try {
          // Start Claude
          const taskPrompt = prompt || task.prompt
          claudeService.start(taskId, resolvedWorkdir, taskPrompt)

          // Record PID
          const pid = terminalService.getPid(taskId)
          if (pid) {
            taskService.update(taskId, { pid, workdir: resolvedWorkdir })
          }

          // PTYデータをレンダラーに転送
          terminalService.onData(taskId, (data) => {
            const win = getWindow()
            if (win && !win.isDestroyed()) {
              win.webContents.send('terminal:data', { taskId, data })
            }
          })

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
        } catch (startError) {
          // Claudeの起動に失敗したらステータスを元に戻す
          taskService.update(taskId, { status: 'will_do' })
          throw startError
        }
      } catch (error) {
        throw new Error(`Failed to start Claude: ${(error as Error).message}`)
      }
    }
  )
}
