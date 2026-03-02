import { create } from 'zustand'

type TerminalStore = {
  activeTaskId: string | null
  isOpen: boolean
  devServerLogKey: string | null

  openTerminal: (taskId: string) => void
  openDevServerLog: (paneId: string, label: string) => void
  closeTerminal: () => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  activeTaskId: null,
  isOpen: false,
  devServerLogKey: null,

  openTerminal: (taskId) =>
    set({ activeTaskId: taskId, isOpen: true, devServerLogKey: null }),

  openDevServerLog: (paneId, label) =>
    set({ devServerLogKey: `${paneId}:${label}`, isOpen: true, activeTaskId: null }),

  closeTerminal: () =>
    set({ isOpen: false, activeTaskId: null, devServerLogKey: null })
}))
