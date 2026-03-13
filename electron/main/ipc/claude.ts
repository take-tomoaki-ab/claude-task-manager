import { ipcMain, type BrowserWindow } from 'electron'
import { expandPath } from '../utils/path'
import type { ClaudeService } from '../services/ClaudeService'
import type { TaskService } from '../services/TaskService'
import type { GitService } from '../services/GitService'
import type { TerminalService } from '../services/TerminalService'
import type { AppSettings } from '../../../src/types/ipc'
import type { Task } from '../../../src/types/task'

function interpolateTemplate(template: string, task: Task): string {
  const vars: Record<string, string> = { title: task.title }
  if ('branch' in task) vars['branch'] = task.branch
  if ('ticket' in task) vars['ticket'] = task.ticket
  if ('url' in task) vars['pr-url'] = task.url
  if ('prompt' in task && task.prompt) vars['prompt'] = task.prompt
  if ('output' in task) vars['output'] = task.output
  if ('directory' in task) vars['directory'] = task.directory
  return template.replace(/\{([^}]+)\}/g, (match, key: string) => vars[key] ?? match)
}

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

        const settings = getSettings()
        let resolvedWorkdir = workdir
        let assignedPane = task.pane

        if (task.type === 'chore' && 'directory' in task) {
          // chore は directory を直接使用（pane不要）
          resolvedWorkdir = expandPath(task.directory)
        } else {
          // non-chore: タスクのリポジトリ内の空きペインを自動割り当て
          const occupiedPaneIds = new Set(
            tasks
              .filter((t) => t.id !== taskId && t.status === 'doing' && t.pane)
              .map((t) => t.pane)
          )
          const repoId = 'repoId' in task ? task.repoId : undefined
          const repo = repoId
            ? settings.repos.find((r) => r.id === repoId)
            : settings.repos[0]
          if (!repo) {
            throw new Error('NO_REPO_ASSIGNED')
          }
          const freePaneConfig = repo.panes.find((p) => !occupiedPaneIds.has(p.id))
          if (!freePaneConfig) {
            throw new Error('NO_FREE_PANE')
          }
          assignedPane = freePaneConfig.id
          resolvedWorkdir = expandPath(freePaneConfig.path)
        }

        // Check for branch checkout（失敗してもステータスをdoingにしない）
        if ('branch' in task && task.branch) {
          const baseBranch = 'baseBranch' in task ? task.baseBranch : undefined
          await gitService.checkout(resolvedWorkdir, task.branch, baseBranch)
        }

        // 事前チェックが全て通ってからステータス・paneをdoingに変更
        taskService.update(taskId, { status: 'doing', pane: assignedPane })

        try {
          // Start Claude
          const rawPrompt = prompt || task.prompt || settings.promptTemplates?.[task.type]
          const taskPrompt = rawPrompt ? interpolateTemplate(rawPrompt, task) : undefined
          const planMode = task.type === 'research'
          const dangerously = !planMode && (settings.useDangerouslySkipPermissions ?? false)
          claudeService.start(taskId, resolvedWorkdir, taskPrompt, dangerously, planMode)

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
