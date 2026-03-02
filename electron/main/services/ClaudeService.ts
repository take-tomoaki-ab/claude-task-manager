import { Notification } from 'electron'
import type { TerminalService } from './TerminalService'
import type { ContextInfo } from '../../../src/types/ipc'

export type ContextUpdateCallback = (info: ContextInfo) => void

export class ClaudeService {
  private terminalService: TerminalService
  private contextCallbacks: Set<ContextUpdateCallback> = new Set()
  private notifiedThresholds: Map<string, Set<number>> = new Map()

  constructor(terminalService: TerminalService) {
    this.terminalService = terminalService
  }

  start(taskId: string, workdir: string, prompt?: string): void {
    this.terminalService.start(taskId, workdir)
    this.terminalService.write(taskId, 'claude\n')

    if (prompt) {
      setTimeout(() => {
        this.terminalService.write(taskId, prompt + '\n')
      }, 500)
    }

    this.notifiedThresholds.set(taskId, new Set())

    this.terminalService.onData(taskId, (data) => {
      const info = this.parseContext(taskId, data)
      if (info) {
        for (const cb of this.contextCallbacks) {
          cb(info)
        }
        this.checkThresholds(info)
      }
    })
  }

  parseContext(taskId: string, data: string): ContextInfo | null {
    const pattern = /Context window usage:\s*([\d,]+)\s*\/\s*([\d,]+)\s*tokens/
    const match = data.match(pattern)
    if (!match) return null

    const used = parseInt(match[1].replace(/,/g, ''), 10)
    const limit = parseInt(match[2].replace(/,/g, ''), 10)

    return { taskId, used, limit }
  }

  onContextUpdate(callback: ContextUpdateCallback): () => void {
    this.contextCallbacks.add(callback)
    return () => {
      this.contextCallbacks.delete(callback)
    }
  }

  private checkThresholds(info: ContextInfo): void {
    const ratio = info.used / info.limit
    const thresholds = this.notifiedThresholds.get(info.taskId)
    if (!thresholds) return

    if (ratio >= 0.9 && !thresholds.has(90)) {
      thresholds.add(90)
      new Notification({
        title: 'コンテキスト警告',
        body: `タスクのコンテキスト使用量が90%を超えました (${info.used.toLocaleString()} / ${info.limit.toLocaleString()})`
      }).show()
    } else if (ratio >= 0.8 && !thresholds.has(80)) {
      thresholds.add(80)
      new Notification({
        title: 'コンテキスト注意',
        body: `タスクのコンテキスト使用量が80%を超えました (${info.used.toLocaleString()} / ${info.limit.toLocaleString()})`
      }).show()
    }
  }
}
