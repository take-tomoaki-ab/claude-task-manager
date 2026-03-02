import { useEffect, useState } from 'react'
import { useTaskStore } from '../stores/taskStore'
import FilterBar from '../components/FilterBar/FilterBar'
import PaneStatusSidebar from '../components/PaneStatusSidebar/PaneStatusSidebar'
import TaskCard from '../components/TaskCard/TaskCard'
import TaskForm from '../components/TaskForm/TaskForm'
import TerminalPanel from '../components/Terminal/TerminalPanel'
import { useTerminalStore } from '../stores/terminalStore'
import type { TaskStatus } from '../types/task'

const COLUMNS: { status: TaskStatus; label: string; borderColor: string }[] = [
  { status: 'will_do', label: '未実行', borderColor: 'border-t-gray-500' },
  { status: 'doing', label: '実行中', borderColor: 'border-t-blue-500' },
  { status: 'done', label: '完了', borderColor: 'border-t-green-500' }
]

export default function DashboardPage() {
  const [formOpen, setFormOpen] = useState(false)
  const fetchTasks = useTaskStore((s) => s.fetchTasks)
  const filteredTasks = useTaskStore((s) => s.filteredTasks)
  const isTerminalOpen = useTerminalStore((s) => s.isOpen)

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  return (
    <div className="h-screen flex flex-col">
      <FilterBar onNewTask={() => setFormOpen(true)} />

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
                <div className={`px-4 py-2 border-t-2 ${col.borderColor} bg-gray-900`}>
                  <h2 className="text-sm font-semibold text-gray-300">
                    {col.label}
                    <span className="ml-2 text-xs text-gray-500">{columnTasks.length}</span>
                  </h2>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
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

      <TaskForm isOpen={formOpen} onClose={() => setFormOpen(false)} />
      <TerminalPanel />
    </div>
  )
}
