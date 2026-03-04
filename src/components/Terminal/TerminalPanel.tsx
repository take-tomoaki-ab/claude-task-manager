import { useEffect, useRef, useCallback, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useTerminalStore } from '../../stores/terminalStore'

const PANEL_WIDTH = 480

type TerminalEntry = {
  terminal: Terminal
  fitAddon: FitAddon
  container: HTMLDivElement  // per-task専用コンテナ（使い回す）
  opened: boolean
}

export default function TerminalPanel() {
  const isOpen = useTerminalStore((s) => s.isOpen)
  const activeTaskId = useTerminalStore((s) => s.activeTaskId)
  const devServerLogKey = useTerminalStore((s) => s.devServerLogKey)
  const closeTerminal = useTerminalStore((s) => s.closeTerminal)

  // ターミナルコンテンツを表示するpanelコンテナ
  const panelContainerRef = useRef<HTMLDivElement>(null)
  // per-task terminalエントリ（dispose しない・使い回す）
  const terminalsRef = useRef<Map<string, TerminalEntry>>(new Map())
  const currentTaskRef = useRef<string | null>(null)
  const resizeObserverRef = useRef<ResizeObserver | null>(null)

  const getOrCreateEntry = useCallback((taskId: string): TerminalEntry => {
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

    // per-task専用コンテナdiv（DOM要素として使い回す）
    const container = document.createElement('div')
    container.style.width = '100%'
    container.style.height = '100%'

    const entry: TerminalEntry = { terminal, fitAddon, container, opened: false }
    terminalsRef.current.set(taskId, entry)
    return entry
  }, [])

  // activeTaskId変化 or isOpen変化でターミナルをマウント
  useEffect(() => {
    if (!isOpen || !activeTaskId || !panelContainerRef.current) return

    const panelEl = panelContainerRef.current

    // 前のタスクのコンテナを取り外す（disposeしない）
    if (currentTaskRef.current && currentTaskRef.current !== activeTaskId) {
      const prev = terminalsRef.current.get(currentTaskRef.current)
      if (prev && panelEl.contains(prev.container)) {
        panelEl.removeChild(prev.container)
      }
    }

    const entry = getOrCreateEntry(activeTaskId)
    currentTaskRef.current = activeTaskId

    // まだ開いていなければ open する（xterm は1回だけ）
    if (!panelEl.contains(entry.container)) {
      panelEl.appendChild(entry.container)
    }

    // xtermがまだopenされていなければopen（1タスクにつき1回のみ）
    if (!entry.opened) {
      entry.terminal.open(entry.container)
      entry.opened = true
    }

    requestAnimationFrame(() => {
      try {
        entry.fitAddon.fit()
        window.api.terminal.resize(activeTaskId, entry.terminal.cols, entry.terminal.rows)
      } catch {
        // ignore fit errors
      }
    })

    // キー入力 → pty
    const disposable = entry.terminal.onData((data) => {
      window.api.terminal.write(activeTaskId, data)
    })

    return () => {
      disposable.dispose()
    }
  }, [isOpen, activeTaskId, getOrCreateEntry])

  // パネルが再表示された時にリサイズ＆強制再描画
  useEffect(() => {
    if (!isOpen || !activeTaskId) return
    const entry = terminalsRef.current.get(activeTaskId)
    if (!entry) return
    requestAnimationFrame(() => {
      try {
        entry.fitAddon.fit()
        entry.terminal.refresh(0, entry.terminal.rows - 1)
        window.api.terminal.resize(activeTaskId, entry.terminal.cols, entry.terminal.rows)
      } catch {
        // ignore
      }
    })
  }, [isOpen, activeTaskId])

  // PTYデータ受信 → 該当タスクのxtermに書き込む（パネルが閉じていても受信する）
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
    if (!panelContainerRef.current) return

    resizeObserverRef.current = new ResizeObserver(() => {
      if (activeTaskId && isOpen) {
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

    resizeObserverRef.current.observe(panelContainerRef.current)

    return () => {
      resizeObserverRef.current?.disconnect()
    }
  }, [activeTaskId, isOpen])

  // アンマウント時のみdispose（パネルを閉じただけではdisposeしない）
  useEffect(() => {
    return () => {
      terminalsRef.current.forEach(({ terminal }) => terminal.dispose())
      terminalsRef.current.clear()
    }
  }, [])

  // isOpenがfalseの時もコンポーネントは存在し続けてPTYデータを受け取り続ける
  return (
    <div
      className="fixed top-0 right-0 h-full bg-gray-900 border-l border-gray-700 flex flex-col z-40"
      style={{ width: PANEL_WIDTH, display: isOpen ? 'flex' : 'none' }}
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

      {/* ターミナルコンテンツ - 常にDOMに存在させてxterm detach問題を防ぐ */}
      <div
        ref={panelContainerRef}
        className="flex-1 overflow-hidden"
        style={{ display: activeTaskId && !devServerLogKey ? 'block' : 'none' }}
      />

      {devServerLogKey && (
        <div className="flex-1 overflow-auto p-4">
          <DevServerLogView logKey={devServerLogKey} />
        </div>
      )}
    </div>
  )
}

function DevServerLogView({ logKey }: { logKey: string }) {
  const colonIdx = logKey.indexOf(':')
  const paneId = logKey.slice(0, colonIdx)
  const label = logKey.slice(colonIdx + 1)
  const [log, setLog] = useState('')
  const bottomRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    let cancelled = false

    const poll = async () => {
      try {
        const text = await window.api.devserver.getLog(paneId, label)
        if (!cancelled) setLog(text)
      } catch {
        // ignore
      }
    }

    poll()
    const id = setInterval(poll, 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [paneId, label])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <pre
      ref={bottomRef}
      className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all"
    >
      {log || <span className="text-gray-500">（ログ待機中...）</span>}
    </pre>
  )
}
