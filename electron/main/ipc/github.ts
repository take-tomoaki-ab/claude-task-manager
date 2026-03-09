import { ipcMain, Notification } from 'electron'
import type { GitHubService } from '../services/GitHubService'
import type { TaskService } from '../services/TaskService'
import type { AppSettings } from '../../../src/types/ipc'
import type { ReviewTask } from '../../../src/types/task'

export function registerGitHubHandlers(
  gitHubService: GitHubService,
  taskService: TaskService,
  getSettings: () => AppSettings
): void {
  ipcMain.handle('github:sync-prs', async () => {
    return syncReviewPRs(gitHubService, taskService, getSettings)
  })
}

export async function syncReviewPRs(
  gitHubService: GitHubService,
  taskService: TaskService,
  getSettings: () => AppSettings
): Promise<{ created: number; total: number }> {
  const settings = getSettings()
  const { githubPat, githubUsername } = settings

  if (!githubPat || !githubUsername) {
    return { created: 0, total: 0 }
  }

  const prs = await gitHubService.fetchReviewRequestedPRs(githubUsername, githubPat)

  // will_do / doing の review タスクの url のみ収集（done・アーカイブは再取得対象）
  const existingTasks = taskService.list()
  const existingUrls = new Set(
    existingTasks
      .filter((t) => t.type === 'review' && (t.status === 'will_do' || t.status === 'doing'))
      .map((t) => (t as { url?: string }).url)
      .filter(Boolean)
  )

  let created = 0
  for (const pr of prs) {
    if (existingUrls.has(pr.html_url)) continue

    taskService.create({
      type: 'review',
      status: 'will_do',
      title: `[${pr.repositoryName}] #${pr.number} ${pr.title}`,
      pane: '',
      url: pr.html_url
    } as Omit<ReviewTask, 'id' | 'created_at'>)
    created++
  }

  if (created > 0) {
    const { notificationsEnabled = true } = settings
    if (notificationsEnabled) {
      new Notification({
        title: 'レビュー依頼のPRを検出',
        body: `${created} 件の新しいレビュー依頼タスクを作成しました`
      }).show()
    }
  }

  return { created, total: prs.length }
}
