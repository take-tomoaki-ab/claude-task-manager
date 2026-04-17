import { Notification } from 'electron'
import type { TerminalService } from './TerminalService'
import type { AppSettings, ContextInfo } from '../../../src/types/ipc'

export type ContextUpdateCallback = (info: ContextInfo) => void

export class ClaudeService {
  private terminalService: TerminalService
  private getSettings: () => Pick<AppSettings, 'notificationsEnabled'>
  private contextCallbacks: Set<ContextUpdateCallback> = new Set()
  private notifiedThresholds: Map<string, Set<number>> = new Map()
  private maxContextUsed: Map<string, number> = new Map()

  constructor(
    terminalService: TerminalService,
    getSettings: () => Pick<AppSettings, 'notificationsEnabled'>
  ) {
    this.terminalService = terminalService
    this.getSettings = getSettings
  }

  start(taskId: string, workdir: string, prompt?: string, dangerously?: boolean, planMode?: boolean, cols?: number, rows?: number, sessionId?: string, resumeSessionId?: string): void {
    this.terminalService.start(taskId, workdir, cols ?? 120, rows ?? 30, { CLAUDE_TASK_ID: taskId })
    let claudeArgs = ''
    if (dangerously) claudeArgs += ' --dangerously-skip-permissions'
    if (planMode) claudeArgs += ' --permission-mode plan'
    if (resumeSessionId) claudeArgs += ` --resume ${resumeSessionId}`
    else if (sessionId) claudeArgs += ` --session-id ${sessionId}`
    const claudeCmd = `claude${claudeArgs}\n`
    this.terminalService.write(taskId, claudeCmd)

    if (!resumeSessionId && prompt) {
      setTimeout(() => {
        if (this.terminalService.hasSession(taskId)) {
          this.terminalService.write(taskId, prompt + '\n')
        }
      }, 2000)
    }

    this.notifiedThresholds.set(taskId, new Set())
    this.maxContextUsed.set(taskId, 0)

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
    const clean = data
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')               // CSI sequences
      .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')   // OSC (BEL or ST terminator)
      .replace(/\x1b[()][AB012]/g, '')                       // charset sequences
      .replace(/\r/g, '')                                    // CR

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

    // Claude Code status bar format: "↓ 8.6k tokens" or "↓ 239 tokens"
    // Tool sub-calls show small values (e.g. ↓ 67 tokens), so track the session maximum
    // to prevent the meter from going backwards.
    const deltaMatch = clean.match(/↓\s*([\d.]+)(k?)\s*tokens/i)
    if (deltaMatch) {
      const raw = parseFloat(deltaMatch[1])
      const parsed = deltaMatch[2].toLowerCase() === 'k' ? Math.round(raw * 1000) : Math.round(raw)
      const prev = this.maxContextUsed.get(taskId) ?? 0
      const used = Math.max(prev, parsed)
      this.maxContextUsed.set(taskId, used)
      if (used > 0) {
        return { taskId, used, limit: 200000 }
      }
    }

    // デバッグ: tokensという文字列が含まれるがパターンにマッチしなかった場合ログ出力
    if (/tokens?/i.test(clean)) {
      console.log('[ClaudeService] context parse miss:', JSON.stringify(clean.slice(0, 200)))
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

    const { notificationsEnabled = true } = this.getSettings()
    if (!notificationsEnabled) return

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
