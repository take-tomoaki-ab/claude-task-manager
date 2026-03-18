import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { Task, RuntimeTaskState, ArchiveEntry, RuntimeTask, DistributiveOmit } from '../../src/types/task'
import type {
  AppSettings,
  GitStatusResult,
  DevServerStatus,
  TerminalDataEvent,
  ContextInfo
} from '../../src/types/ipc'

const api = {
  tasks: {
    list: (): Promise<RuntimeTask[]> => ipcRenderer.invoke('tasks:list'),
    create: (task: DistributiveOmit<Task, 'id' | 'created_at'>): Promise<RuntimeTask> =>
      ipcRenderer.invoke('tasks:create', task),
    update: (id: string, data: Partial<Task & RuntimeTaskState>): Promise<RuntimeTask> =>
      ipcRenderer.invoke('tasks:update', { id, data }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('tasks:delete', id),
    archive: (id: string): Promise<void> => ipcRenderer.invoke('tasks:archive', id),
    listArchived: (): Promise<ArchiveEntry[]> => ipcRenderer.invoke('tasks:list-archived'),
    deleteArchived: (id: string): Promise<void> =>
      ipcRenderer.invoke('tasks:delete-archived', id),
    archiveAllDone: (): Promise<number> =>
      ipcRenderer.invoke('tasks:archive-all-done'),
    deleteAllArchived: (): Promise<number> =>
      ipcRenderer.invoke('tasks:delete-all-archived'),
    restoreArchived: (id: string): Promise<RuntimeTask> =>
      ipcRenderer.invoke('tasks:restore-archived', id),
    onUpdated: (callback: () => void): (() => void) => {
      const listener = (): void => callback()
      ipcRenderer.on('tasks:updated', listener)
      return () => ipcRenderer.removeListener('tasks:updated', listener)
    }
  },

  terminal: {
    start: (taskId: string, workdir: string): Promise<void> =>
      ipcRenderer.invoke('terminal:start', { taskId, workdir }),
    write: (taskId: string, data: string): Promise<void> =>
      ipcRenderer.invoke('terminal:write', { taskId, data }),
    kill: (taskId: string): Promise<void> => ipcRenderer.invoke('terminal:kill', taskId),
    resize: (taskId: string, cols: number, rows: number): Promise<void> =>
      ipcRenderer.invoke('terminal:resize', { taskId, cols, rows }),
    onData: (callback: (event: TerminalDataEvent) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, event: TerminalDataEvent): void => callback(event)
      ipcRenderer.on('terminal:data', listener)
      return () => ipcRenderer.removeListener('terminal:data', listener)
    },
    offData: (_taskId: string): void => {
      // Individual task cleanup is handled by the unsubscribe returned from onData
    }
  },

  git: {
    status: (workdir: string): Promise<GitStatusResult> =>
      ipcRenderer.invoke('git:status', workdir),
    branches: (workdir: string): Promise<string[]> =>
      ipcRenderer.invoke('git:branches', workdir)
  },

  claude: {
    start: (taskId: string, workdir: string, prompt?: string): Promise<void> =>
      ipcRenderer.invoke('claude:start', { taskId, workdir, prompt }),
    onContextUpdate: (callback: (info: ContextInfo) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, info: ContextInfo): void => callback(info)
      ipcRenderer.on('claude:context-update', listener)
      return () => ipcRenderer.removeListener('claude:context-update', listener)
    },
  },

  devserver: {
    start: (paneId: string, label: string): Promise<void> =>
      ipcRenderer.invoke('devserver:start', { paneId, label }),
    stop: (paneId: string, label: string): Promise<void> =>
      ipcRenderer.invoke('devserver:stop', { paneId, label }),
    status: (): Promise<DevServerStatus[]> => ipcRenderer.invoke('devserver:status'),
    onStatusChange: (callback: (statuses: DevServerStatus[]) => void): (() => void) => {
      const listener = (_: IpcRendererEvent, statuses: DevServerStatus[]): void =>
        callback(statuses)
      ipcRenderer.on('devserver:status-change', listener)
      return () => ipcRenderer.removeListener('devserver:status-change', listener)
    },
    getLog: (paneId: string, label: string): Promise<string> =>
      ipcRenderer.invoke('devserver:log', { paneId, label })
  },

  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    set: (settings: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke('settings:set', settings),
    export: (): Promise<boolean> => ipcRenderer.invoke('settings:export'),
    import: (): Promise<AppSettings | null> => ipcRenderer.invoke('settings:import')
  },

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:open-external', url),
    listImages: (dir: string): Promise<string[]> =>
      ipcRenderer.invoke('shell:list-images', dir)
  },

  dialog: {
    openDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:open-directory')
  },

  github: {
    syncPRs: (): Promise<{ created: number; total: number }> =>
      ipcRenderer.invoke('github:sync-prs')
  },

  ticket: {
    fetch: (url: string) => ipcRenderer.invoke('ticket:fetch', url),
    providers: () => ipcRenderer.invoke('ticket:providers'),
    catalog: () => ipcRenderer.invoke('plugin:catalog'),
    install: (id: string) => ipcRenderer.invoke('plugin:install', id),
    uninstall: (id: string) => ipcRenderer.invoke('plugin:uninstall', id)
  },

  hooks: {
    status: (): Promise<{ installed: boolean; path: string; managedByApp: boolean; registeredInSettings: boolean }> =>
      ipcRenderer.invoke('hooks:status'),
    install: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('hooks:install'),
    uninstall: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('hooks:uninstall')
  }
}

contextBridge.exposeInMainWorld('api', api)
