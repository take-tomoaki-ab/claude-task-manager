import { useEffect, useRef, useCallback } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'

const PANEL_WIDTH = 480

export default function TerminalPanel() {
  const isOpen = useTerminalStore((s) => s.isOpen)
  const activeTaskId = useTerminalStore((s) => s.activeTaskId)
  const devServerLogKey = useTerminalStore((s) => s.devServerLogKey)
  const closeTerminal = useTerminalStore((s) => s.closeTerminal)

  const containerRef = useRef<HTMLDivElement>(null)
  const terminalsRef = useRef<Map<string, { terminal: Terminal; fitAddon: FitAddon }>>(new Map())
  const currentTermRef = useRef<string | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const getOrCreateTerminal = useCallback((taskId: string) => {
    const existing = terminalsRef.current.get(taskId)
    if (existing) return existing

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1a1b1e',
        foreground: '#e2e8f0'
      }
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const entry = { terminal, fitAddon }
    terminalsRef.current.set(taskId, entry)
    return entry
  }, [])

  // Mount/unmount terminal when activeTaskId changes
  useEffect(() => {
    if (!isOpen || !activeTaskId || !containerRef.current) return

    // Detach previous terminal
    if (currentTermRef.current && currentTermRef.current !== activeTaskId) {
      const prev = terminalsRef.current.get(currentTermRef.current)
      if (prev) {
        // Don't dispose, just detach from DOM
        const el = containerRef.current.querySelector('.xterm')
        if (el) el.remove()
      }
    }

    const { terminal, fitAddon } = getOrCreateTerminal(activeTaskId)
    currentTermRef.current = activeTaskId

    // Clear container and open terminal
    containerRef.current.innerHTML = ''
    terminal.open(containerRef.current)

    // Fit after small delay for layout
    requestAnimationFrame(() => {
      try {
        fitAddon.fit()
        window.api.terminal.resize(activeTaskId, terminal.cols, terminal.rows)
      } catch {
        // ignore fit errors
      }
    })

    // Key input -> pty
    const disposable = terminal.onData((data) => {
      window.api.terminal.write(activeTaskId, data)
    })

    return () => {
      disposable.dispose()
    }
  }, [isOpen, activeTaskId, getOrCreateTerminal])

  // Subscribe to terminal data
  useEffect(() => {
    const unsub = window.api.terminal.onData((event) => {
      const entry = terminalsRef.current.get(event.taskId)
      if (entry) {
        entry.terminal.write(event.data)
      }
    })
    return unsub
  }, [])

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return

    resizeObserverRef.current = new ResizeObserver(() => {
      if (activeTaskId) {
        const entry = terminalsRef.current.get(activeTaskId)
        if (entry) {
          try {
            entry.fitAddon.fit()
            window.api.terminal.resize(activeTaskId, entry.terminal.cols, entry.terminal.rows)
          } catch {
            // ignore
          }
        }
      }
    })

    resizeObserverRef.current.observe(containerRef.current)

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [activeTaskId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      terminalsRef.current.forEach(({ terminal }) => terminal.dispose())
      terminalsRef.current.clear()
    }
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed top-0 right-0 h-full bg-gray-900 border-l border-gray-700 flex flex-col z-40"
      style={{ width: PANEL_WIDTH }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
        <div className="text-sm font-medium text-white truncate">
          {activeTaskId ? `Terminal: ${activeTaskId}` : devServerLogKey ? `Log: ${devServerLogKey}` : 'Terminal'}
        </div>
        <button
          onClick={closeTerminal}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          {'\u00D7'}
        </button>
      </div>

      {/* Content */}
      {activeTaskId && (
        <div ref={containerRef} className="flex-1 overflow-hidden" />
      )}

      {devServerLogKey && (
        <div className="flex-1 overflow-auto p-4">
          <DevServerLogView logKey={devServerLogKey} />
        </div>
      )}
    </div>
  )
}

function DevServerLogView({ logKey }: { logKey: string }) {
  const [paneId, label] = logKey.split(':')

  useEffect(() => {
    window.api.devserver.openLog(paneId, label)
  }, [paneId, label])

  return (
    <div className="text-xs font-mono text-gray-300">
      <p className="text-gray-500">Dev server log: {paneId} / {label}</p>
      <p className="text-gray-500 mt-2">ログは別ウィンドウで表示されます</p>
    </div>
  )
}
