import { create } from 'zustand'
import type { RuntimeTask, TaskType, Task, RuntimeTaskState } from '../types/task'

type TaskStore = {
  tasks: RuntimeTask[]
  filteredTasks: RuntimeTask[]
  searchQuery: string
  typeFilters: TaskType[]

  fetchTasks: () => Promise<void>
  createTask: (task: Omit<Task, 'id' | 'created_at'>) => Promise<void>
  updateTask: (id: string, data: Partial<Task & RuntimeTaskState>) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  archiveTask: (id: string) => Promise<void>
  startTask: (taskId: string, forceStart?: boolean) => Promise<{ conflict?: boolean; conflictingTask?: RuntimeTask }>
  setSearchQuery: (q: string) => void
  setTypeFilters: (types: TaskType[]) => void
}

function applyFilters(tasks: RuntimeTask[], searchQuery: string, typeFilters: TaskType[]): RuntimeTask[] {
  let result = tasks
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    result = result.filter((t) => {
      if (t.title.toLowerCase().includes(q)) return true
      if ('branch' in t && t.branch?.toLowerCase().includes(q)) return true
      if ('ticket' in t && t.ticket?.toLowerCase().includes(q)) return true
      if ('url' in t && t.url?.toLowerCase().includes(q)) return true
      return false
    })
  }
  if (typeFilters.length > 0) {
    result = result.filter((t) => typeFilters.includes(t.type))
  }
  return result
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  filteredTasks: [],
  searchQuery: '',
  typeFilters: [],

  fetchTasks: async () => {
    const tasks = await window.api.tasks.list()
    const { searchQuery, typeFilters } = get()
    set({ tasks, filteredTasks: applyFilters(tasks, searchQuery, typeFilters) })
  },

  createTask: async (task) => {
    await window.api.tasks.create(task)
    await get().fetchTasks()
  },

  updateTask: async (id, data) => {
    await window.api.tasks.update(id, data)
    await get().fetchTasks()
  },

  deleteTask: async (id) => {
    await window.api.tasks.delete(id)
    await get().fetchTasks()
  },

  archiveTask: async (id) => {
    await window.api.tasks.archive(id)
    await get().fetchTasks()
  },

  startTask: async (taskId, forceStart) => {
    const { tasks } = get()
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return {}

    const workdir = task.workdir || ''
    const prompt = task.prompt

    try {
      await window.api.claude.start(taskId, workdir, prompt)
      await get().fetchTasks()
      return {}
    } catch (err: unknown) {
      const error = err as Error & { conflictingTask?: RuntimeTask }
      if (error.message === 'PANE_CONFLICT' && !forceStart) {
        const conflictingTask = error.conflictingTask || tasks.find(
          (t) => t.pane === task.pane && t.status === 'doing' && t.id !== taskId
        )
        return { conflict: true, conflictingTask }
      }
      throw err
    }
  },

  setSearchQuery: (q) => {
    const { tasks, typeFilters } = get()
    set({ searchQuery: q, filteredTasks: applyFilters(tasks, q, typeFilters) })
  },

  setTypeFilters: (types) => {
    const { tasks, searchQuery } = get()
    set({ typeFilters: types, filteredTasks: applyFilters(tasks, searchQuery, types) })
  }
}))
