// 既存の /Users/s28773/Desktop/tasks/task.ts をベースにテンプレートリテラル型を除去した型定義

export type TaskStatus = 'will_do' | 'doing' | 'done'
export type TaskType = 'feat' | 'design' | 'review' | 'qa' | 'research' | 'chore'

export type BaseTask = {
  id: string
  prompt?: string
  status: TaskStatus
  depends_on?: string
  pane: string
  title: string
  created_at?: string
}

export type DesignTask = {
  type: 'design'
  output: string
} & BaseTask

export type FeatureTask = {
  type: 'feat'
  branch: string
  baseBranch?: string  // 分岐元ブランチ
  prompt: string
  ticket: string  // Wrike ticket URL
} & BaseTask

export type ReviewTask = {
  type: 'review'
  url: string  // GitHub PR URL
} & BaseTask

export type QATask = {
  type: 'qa'
  branch: string
  baseBranch?: string  // 分岐元ブランチ
  ticket: string  // Wrike ticket URL
} & BaseTask

export type ResearchTask = {
  type: 'research'
  branch: string
  prompt: string
} & BaseTask

export type ChoreTask = {
  type: 'chore'
  directory: string
} & BaseTask

export type Task = DesignTask | FeatureTask | ReviewTask | QATask | ResearchTask | ChoreTask

// ランタイム状態（DB の task_runtime テーブルで管理）
export type RuntimeTaskState = {
  pid?: number
  workdir?: string
  contextUsed?: number
  contextLimit?: number
  startedAt?: string
  completedAt?: string
  isArchived?: boolean
}

export type RuntimeTask = Task & RuntimeTaskState

// アーカイブエントリ
export type ArchiveEntry = {
  id: string
  task_data: RuntimeTask
  archived_at: string
}
