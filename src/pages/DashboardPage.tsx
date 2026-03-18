import { useEffect, useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import FilterBar from '../components/FilterBar/FilterBar'
import PaneStatusSidebar from '../components/PaneStatusSidebar/PaneStatusSidebar'
import TaskCard from '../components/TaskCard/TaskCard'
import TaskForm from '../components/TaskForm/TaskForm'
import TerminalPanel from '../components/Terminal/TerminalPanel'
import { useTerminalStore } from '../stores/terminalStore'
import type { TaskStatus, RuntimeTask } from '../types/task'
import type { RepoConfig } from '../types/ipc'

const COLUMNS: { status: TaskStatus; label: string; borderColor: string }[] = [
  { status: 'will_do', label: '未実行', borderColor: 'border-t-gray-500' },
  { status: 'doing', label: '実行中', borderColor: 'border-t-blue-500' },
  { status: 'done', label: '完了', borderColor: 'border-t-green-500' }
]

export default function DashboardPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<RuntimeTask | null>(null)
  const [repos, setRepos] = useState<RepoConfig[]>([])
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const filteredTasks = useTaskStore((s) => s.filteredTasks)
  const tasks = useTaskStore((s) => s.tasks)
  const archiveAllDone = useTaskStore((s) => s.archiveAllDone)
  const isTerminalOpen = useTerminalStore((s) => s.isOpen)

  useEffect(() => {
    fetchTasks()
    window.api.settings.get().then((s) => setRepos(s.repos ?? []))
  }, [fetchTasks])

  useEffect(() => {
    return window.api.tasks.onUpdated(() => {
      fetchTasks()
    })
  }, [fetchTasks])

  // タスクごとに、そのリポジトリに空きペインがあるか判定
  const occupiedPaneIds = new Set(
    tasks.filter((t) => t.status === 'doing' && t.pane).map((t) => t.pane)
  )
  const hasFreePaneForTask = (task: RuntimeTask): boolean => {
    if (task.type === 'chore') return true
    const repo = task.repoId
      ? repos.find((r) => r.id === task.repoId)
      : repos[0]
    if (!repo) return false
    return repo.panes.some((p) => !occupiedPaneIds.has(p.id))
  }

  return (
    <div className="h-screen flex flex-col">
      <FilterBar onNewTask={() => { setEditingTask(null); setFormOpen(true) }} />

      <div className="flex flex-1 overflow-hidden">
        <PaneStatusSidebar />

        <div
          className="flex-1 flex overflow-hidden transition-all"
          style={{ marginRight: isTerminalOpen ? 480 : 0 }}
        >
          {COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.status)
            return (
              <div key={col.status} className="flex-1 flex flex-col min-w-0">
                <div className={`px-4 py-2 border-t-2 ${col.borderColor} bg-gray-900 flex items-center justify-between`}>
                  <h2 className="text-sm font-semibold text-gray-300">
                    {col.label}
                    <span className="ml-2 text-xs text-gray-500">{columnTasks.length}</span>
                  </h2>
                  {col.status === 'done' && columnTasks.length > 0 && (
                    <button
                      onClick={() => archiveAllDone()}
                      className="text-xs px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                      title="完了タスクを全てアーカイブ"
                    >
                      一括アーカイブ
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {columnTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      hasFreePane={hasFreePaneForTask(task)}
                      onEdit={task.status === 'will_do' ? (t) => { setEditingTask(t); setFormOpen(true) } : undefined}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-xs text-gray-600 text-center mt-4">タスクなし</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <TaskForm
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditingTask(null) }}
        editTask={editingTask ?? undefined}
      />
      <TerminalPanel />
    </div>
  )
}
