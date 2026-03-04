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

  start(taskId: string, workdir: string, prompt?: string, dangerously?: boolean): void {
    this.terminalService.start(taskId, workdir)
    const claudeCmd = dangerously ? 'claude --dangerously-skip-permissions\n' : 'claude\n'
    this.terminalService.write(taskId, claudeCmd)

    if (prompt) {
      setTimeout(() => {
        this.terminalService.write(taskId, prompt + '\n')
      }, 2000)
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
    // ANSIエスケープシーケンスを除去
    const clean = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '')

    const patterns = [
      // "Context window usage: 75,234 / 100,000 tokens"
      /[Cc]ontext\s+window\s+usage:\s*([\d,]+)\s*\/\s*([\d,]+)\s*tokens/,
      // "Context: 75,234 / 100,000 tokens"
      /[Cc]ontext:\s*([\d,]+)\s*\/\s*([\d,]+)\s*tokens/,
      // "75% (75,234/100,000 tokens)"
      /\d+%\s*\(\s*([\d,]+)\s*\/\s*([\d,]+)\s*tokens?\)/i,
      // "tokens: 75234/100000"
      /tokens?:?\s*([\d,]+)\s*\/\s*([\d,]+)/i,
    ]

    for (const pattern of patterns) {
      const match = clean.match(pattern)
      if (match) {
        const used = parseInt(match[1].replace(/,/g, ''), 10)
        const limit = parseInt(match[2].replace(/,/g, ''), 10)
        if (used > 0 && limit > 0 && used <= limit) {
          return { taskId, used, limit }
        }
      }
    }

    return null
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
