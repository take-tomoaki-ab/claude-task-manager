import { create } from 'zustand'

type TerminalStore = {
  activeTaskId: string | null
  isOpen: boolean
  devServerLogKey: string | null

  openTerminal: (taskId: string) => void
  openDevServerLog: (repoId: string, paneId: string, label: string) => void
  closeTerminal: () => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  activeTaskId: null,
  isOpen: false,
  devServerLogKey: null,

  openTerminal: (taskId) =>
    set({ activeTaskId: taskId, isOpen: true, devServerLogKey: null }),

  openDevServerLog: (repoId, paneId, label) =>
    set({ devServerLogKey: `${repoId}:${paneId}:${label}`, isOpen: true, activeTaskId: null }),

  closeTerminal: () =>
    // activeTaskId は保持する（再度開いたとき同じセッションを再表示するため）
    set({ isOpen: false, devServerLogKey: null })
}))
