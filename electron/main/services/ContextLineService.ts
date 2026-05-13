import fs from 'fs'
import path from 'path'
import { homedir } from 'os'
import type { ContextInfo } from '../../../src/types/ipc'
import type { LocalHttpServer } from './LocalHttpServer'

const STATUSLINE_FILE = path.join(homedir(), '.claude', 'statusline.sh')
const CLAUDE_SETTINGS_FILE = path.join(homedir(), '.claude', 'settings.json')
const APP_MARKER = 'Claude Task Manager'

const STATUSLINE_CONTENT = `#!/bin/sh
# ${APP_MARKER} - Status Line
# このファイルは Claude Task Manager アプリが自動生成しました。
# アプリの設定画面から管理できます。
INPUT=$(cat)
PORT_FILE="$HOME/.claude-task-manager/port"
if [ -z "$CLAUDE_TASK_ID" ] || [ ! -f "$PORT_FILE" ]; then
  exit 0
fi
PORT=$(cat "$PORT_FILE")
curl -s --max-time 2 -X POST "http://127.0.0.1:$PORT/context-update" \\
  -H "Content-Type: application/json" \\
  -d "{\\"taskId\\":\\"$CLAUDE_TASK_ID\\",\\"data\\":$INPUT}" > /dev/null 2>&1 || true
`

type ClaudeSettings = { statusLine?: unknown; [key: string]: unknown }

export class ContextLineService {
  private callbacks = new Set<(info: ContextInfo) => void>()
  // サブエージェントが同じ CLAUDE_TASK_ID を継承して小さいコンテキストで更新するため、
  // セッション最大値を記録してメーターの逆行を防ぐ
  private maxContextUsed = new Map<string, number>()

  constructor(localServer: LocalHttpServer) {
    localServer.addRoute('/context-update', (body, res) => {
      try {
        const { taskId, data } = JSON.parse(body) as { taskId?: string; data?: { context_window?: { total_input_tokens?: number; total_output_tokens?: number; context_window_size?: number } } }
        const cw = data?.context_window
        if (taskId && cw?.context_window_size) {
          const raw = (cw.total_input_tokens ?? 0) + (cw.total_output_tokens ?? 0)
          const limit = cw.context_window_size
          const prevMax = this.maxContextUsed.get(taskId) ?? 0
          const used = Math.max(prevMax, raw)
          this.maxContextUsed.set(taskId, used)
          for (const cb of this.callbacks) cb({ taskId, used, limit })
        }
        res.writeHead(200)
        res.end('ok')
      } catch {
        res.writeHead(400)
        res.end('bad request')
      }
    })
  }

  resetTask(taskId: string): void {
    this.maxContextUsed.delete(taskId)
  }

  onContextUpdate(cb: (info: ContextInfo) => void): () => void {
    this.callbacks.add(cb)
    return () => this.callbacks.delete(cb)
  }

  installStatusLine(): { success: boolean; error?: string } {
    try {
      if (fs.existsSync(STATUSLINE_FILE)) {
        const existing = fs.readFileSync(STATUSLINE_FILE, 'utf-8')
        if (!existing.includes(APP_MARKER)) {
          return {
            success: false,
            error: `${STATUSLINE_FILE} に既存の statusline.sh が存在します。手動でバックアップしてから再実行してください。`
          }
        }
      }
      fs.mkdirSync(path.dirname(STATUSLINE_FILE), { recursive: true })
      fs.writeFileSync(STATUSLINE_FILE, STATUSLINE_CONTENT, { encoding: 'utf-8', mode: 0o755 })

      const settings = this.readClaudeSettings()
      if (!this.isRegisteredInSettings(settings)) {
        settings.statusLine = { type: 'command', command: STATUSLINE_FILE }
        fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_FILE), { recursive: true })
        fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  uninstallStatusLine(): { success: boolean; error?: string } {
    try {
      if (fs.existsSync(STATUSLINE_FILE)) {
        const existing = fs.readFileSync(STATUSLINE_FILE, 'utf-8')
        if (!existing.includes(APP_MARKER)) {
          return {
            success: false,
            error: `${STATUSLINE_FILE} はこのアプリが管理するファイルではないため削除できません。`
          }
        }
        fs.unlinkSync(STATUSLINE_FILE)
      }

      const settings = this.readClaudeSettings()
      if (this.isRegisteredInSettings(settings)) {
        delete settings.statusLine
        fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
      }

      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  getStatusLineStatus(): { installed: boolean; path: string; managedByApp: boolean; registeredInSettings: boolean } {
    const exists = fs.existsSync(STATUSLINE_FILE)
    let managedByApp = false
    if (exists) {
      try {
        const content = fs.readFileSync(STATUSLINE_FILE, 'utf-8')
        managedByApp = content.includes(APP_MARKER)
      } catch {
        // ignore
      }
    }
    const settings = this.readClaudeSettings()
    const registeredInSettings = this.isRegisteredInSettings(settings)
    return { installed: exists, path: STATUSLINE_FILE, managedByApp, registeredInSettings }
  }

  private readClaudeSettings(): ClaudeSettings {
    try {
      const content = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8')
      return JSON.parse(content) as ClaudeSettings
    } catch {
      return {}
    }
  }

  private isRegisteredInSettings(settings: ClaudeSettings): boolean {
    const sl = settings.statusLine as { command?: string } | undefined
    return sl?.command === STATUSLINE_FILE
  }
}
