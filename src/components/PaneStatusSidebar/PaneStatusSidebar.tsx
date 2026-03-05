import { useState, useEffect } from 'react'
import type { PaneConfig, DevServerStatus } from '../../types/ipc'
import { useTerminalStore } from '../../stores/terminalStore'

export default function PaneStatusSidebar() {
  const [panes, setPanes] = useState<PaneConfig[]>([])
  const [serverStatuses, setServerStatuses] = useState<DevServerStatus[]>([])
  const [collapsedPanes, setCollapsedPanes] = useState<Set<string>>(new Set())
  const openDevServerLog = useTerminalStore((s) => s.openDevServerLog)

  const toggleCollapse = (paneId: string) => {
    setCollapsedPanes((prev) => {
      const next = new Set(prev)
      if (next.has(paneId)) {
        next.delete(paneId)
      } else {
        next.add(paneId)
      }
      return next
    })
  }

  useEffect(() => {
    const load = async () => {
      const settings = await window.api.settings.get()
      setPanes(settings.panes)
      const statuses = await window.api.devserver.status()
      setServerStatuses(statuses)
    }
    load()

    const unsub = window.api.devserver.onStatusChange((statuses) => {
      setServerStatuses(statuses)
    })
    return unsub
  }, [])

  const getServerStatus = (paneId: string, label: string): DevServerStatus | undefined => {
    return serverStatuses.find((s) => s.paneId === paneId && s.label === label)
  }

  const toggleServer = async (paneId: string, label: string) => {
    const status = getServerStatus(paneId, label)
    if (status?.running) {
      await window.api.devserver.stop(paneId, label)
    } else {
      await window.api.devserver.start(paneId, label)
    }
  }

  const shortenPath = (p: string): string => {
    const parts = p.split('/')
    if (parts.length <= 3) return p
    return '.../' + parts.slice(-2).join('/')
  }

  return (
    <div className="w-48 bg-gray-900 border-r border-gray-700 overflow-y-auto h-full">
      <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Panes
      </div>
      {panes.map((pane) => {
        const isCollapsed = collapsedPanes.has(pane.id)
        const runningServers = pane.devServers.filter(
          (ds) => getServerStatus(pane.id, ds.label)?.running,
        )
        const serversToShow = isCollapsed ? runningServers : pane.devServers
        return (
          <div key={pane.id} className="border-b border-gray-800">
            <button
              className="w-full flex items-center gap-1 px-3 py-2 hover:bg-gray-800 text-left"
              onClick={() => toggleCollapse(pane.id)}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="currentColor"
                className={`text-gray-500 flex-shrink-0 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              >
                <path d="M0 2.5l5 5 5-5H0z" />
              </svg>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-white leading-none">{pane.id}</div>
                <div className="text-xs text-gray-500 font-mono truncate mt-0.5" title={pane.path}>
                  {shortenPath(pane.path)}
                </div>
              </div>
              {isCollapsed && runningServers.length > 0 && (
                <span className="text-green-400 text-xs flex-shrink-0">●{runningServers.length}</span>
              )}
            </button>
            {serversToShow.length > 0 && (
              <div className="px-3 pb-2">
                {serversToShow.map((ds) => {
                  const status = getServerStatus(pane.id, ds.label)
                  const running = status?.running ?? false
                  return (
                    <div
                      key={ds.label}
                      className="flex items-center gap-0.5 pl-2 text-xs hover:bg-gray-800 rounded py-0.5 group"
                    >
                      <button
                        className="flex items-center gap-1.5 flex-1 cursor-pointer text-left"
                        onClick={() => toggleServer(pane.id, ds.label)}
                        title={status?.port ? `Port: ${status.port} — クリックで${running ? '停止' : '起動'}` : `クリックで${running ? '停止' : '起動'}`}
                      >
                        <span className={running ? 'text-green-400' : 'text-gray-500'}>
                          {running ? '\u25CF' : '\u25CB'}
                        </span>
                        <span className={running ? 'text-gray-200' : 'text-gray-500'}>
                          {ds.label}
                        </span>
                      </button>
                      <button
                        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-gray-200 px-1 transition-opacity"
                        onClick={() => openDevServerLog(pane.id, ds.label)}
                        title="ログを開く"
                      >
                        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M2 2h12v2H2V2zm0 4h12v2H2V6zm0 4h8v2H2v-2z"/>
                        </svg>
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
