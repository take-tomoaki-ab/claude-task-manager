import { ipcMain, Notification } from 'electron'
import type { GitHubService } from '../services/GitHubService'
import type { TaskService } from '../services/TaskService'
import type { AppSettings } from '../../../src/types/ipc'

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

  // 既存タスク（review タイプ）の url を収集
  const existingTasks = taskService.list()
  const existingUrls = new Set(
    existingTasks
      .filter((t) => t.type === 'review')
      .map((t) => (t as { url?: string }).url)
      .filter(Boolean)
  )

  // アーカイブ済みの url も収集
  const archived = taskService.listArchived()
  for (const entry of archived) {
    const task = entry.task_data
    if (task.type === 'review') {
      const url = (task as { url?: string }).url
      if (url) existingUrls.add(url)
    }
  }

  let created = 0
  for (const pr of prs) {
    if (existingUrls.has(pr.html_url)) continue

    taskService.create({
      type: 'review',
      status: 'will_do',
      title: `[${pr.repositoryName}] #${pr.number} ${pr.title}`,
      pane: '',
      url: pr.html_url
    })
    created++
  }

  if (created > 0) {
    new Notification({
      title: 'レビュー依頼のPRを検出',
      body: `${created} 件の新しいレビュー依頼タスクを作成しました`
    }).show()
  }

  return { created, total: prs.length }
}
