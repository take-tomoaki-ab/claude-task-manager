import { useState, useEffect } from 'react'
import type { PaneConfig, DevServerStatus } from '../../types/ipc'
import { useTerminalStore } from '../../stores/terminalStore'

export default function PaneStatusSidebar() {
  const [panes, setPanes] = useState<PaneConfig[]>([])
  const [serverStatuses, setServerStatuses] = useState<DevServerStatus[]>([])
  const openDevServerLog = useTerminalStore((s) => s.openDevServerLog)

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
      {panes.map((pane) => (
        <div key={pane.id} className="px-3 py-2 border-b border-gray-800">
          <div className="text-sm font-medium text-white">{pane.id}</div>
          <div className="text-xs text-gray-500 font-mono truncate" title={pane.path}>
            {shortenPath(pane.path)}
          </div>
          {pane.devServers.map((ds) => {
            const status = getServerStatus(pane.id, ds.label)
            const running = status?.running ?? false
            return (
              <div
                key={ds.label}
                className="flex items-center gap-1.5 mt-1 pl-2 text-xs cursor-pointer hover:bg-gray-800 rounded py-0.5"
                onClick={() => toggleServer(pane.id, ds.label)}
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  openDevServerLog(pane.id, ds.label)
                }}
                title={status?.port ? `Port: ${status.port}` : undefined}
              >
                <span className={running ? 'text-green-400' : 'text-gray-500'}>
                  {running ? '\u25CF' : '\u25CB'}
                </span>
                <span className={running ? 'text-gray-200' : 'text-gray-500'}>
                  {ds.label}
                </span>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
