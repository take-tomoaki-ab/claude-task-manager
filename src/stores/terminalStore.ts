import { create } from 'zustand'

type TerminalStore = {
  activeTaskId: string | null
  isOpen: boolean
  devServerLogKey: string | null
  panelCols: number
  panelRows: number

  openTerminal: (taskId: string) => void
  openDevServerLog: (repoId: string, paneId: string, label: string) => void
  closeTerminal: () => void
  setPanelDimensions: (cols: number, rows: number) => void
}

export const useTerminalStore = create<TerminalStore>((set) => ({
  activeTaskId: null,
  isOpen: false,
  devServerLogKey: null,
  panelCols: 60,
  panelRows: 30,

  openTerminal: (taskId) =>
    set({ activeTaskId: taskId, isOpen: true, devServerLogKey: null }),

  openDevServerLog: (repoId, paneId, label) =>
    set({ devServerLogKey: `${repoId}:${paneId}:${label}`, isOpen: true, activeTaskId: null }),

  closeTerminal: () =>
    // activeTaskId は保持する（再度開いたとき同じセッションを再表示するため）
    set({ isOpen: false, devServerLogKey: null }),

  setPanelDimensions: (cols, rows) => set({ panelCols: cols, panelRows: rows })
}))
