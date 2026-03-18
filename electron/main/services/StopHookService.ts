import http from 'http'
import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const PORT_FILE_DIR = path.join(homedir(), '.claude-task-manager')
const PORT_FILE = path.join(PORT_FILE_DIR, 'port')
const HOOK_INSTALL_DIR = path.join(homedir(), '.claude', 'hooks')
const HOOK_FILE = path.join(HOOK_INSTALL_DIR, 'stop.sh')

const HOOK_CONTENT = `#!/bin/sh
# Claude Task Manager - Stop Hook
# このファイルは Claude Task Manager アプリが自動生成しました。
# アプリの設定画面から管理できます。
PORT_FILE="$HOME/.claude-task-manager/port"
if [ -z "$CLAUDE_TASK_ID" ] || [ ! -f "$PORT_FILE" ]; then
  exit 0
fi
PORT=$(cat "$PORT_FILE")
curl -s -X POST "http://127.0.0.1:$PORT/task-done" \\
  -H "Content-Type: application/json" \\
  -d "{\\"taskId\\":\\"$CLAUDE_TASK_ID\\"}" || true
`

const DEFAULT_PORT = 39457

export class StopHookService {
  private server: http.Server | null = null
  private port: number = 0
  private callbacks = new Map<string, () => void>()

  async start(port: number = DEFAULT_PORT): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method === 'POST' && req.url === '/task-done') {
          let body = ''
          req.on('data', (chunk) => { body += chunk })
          req.on('end', () => {
            try {
              const { taskId } = JSON.parse(body) as { taskId?: string }
              if (taskId) {
                const cb = this.callbacks.get(taskId)
                if (cb) {
                  this.callbacks.delete(taskId)
                  cb()
                }
              }
              res.writeHead(200)
              res.end('ok')
            } catch {
              res.writeHead(400)
              res.end('bad request')
            }
          })
        } else {
          res.writeHead(404)
          res.end('not found')
        }
      })

      this.server.listen(port, '127.0.0.1', () => {
        const addr = this.server?.address()
        if (!addr || typeof addr === 'string') {
          reject(new Error('Failed to get server address'))
          return
        }
        this.port = addr.port
        try {
          fs.mkdirSync(PORT_FILE_DIR, { recursive: true })
          fs.writeFileSync(PORT_FILE, String(this.port), 'utf-8')
          console.log(`[StopHookService] listening on port ${this.port}`)
          resolve()
        } catch (e) {
          reject(e)
        }
      })

      this.server.on('error', reject)
    })
  }

  getPort(): number {
    return this.port
  }

  onTaskComplete(taskId: string, cb: () => void): void {
    this.callbacks.set(taskId, cb)
  }

  removeTaskCallback(taskId: string): void {
    this.callbacks.delete(taskId)
  }

  installHook(): { success: boolean; error?: string } {
    try {
      if (fs.existsSync(HOOK_FILE)) {
        const existing = fs.readFileSync(HOOK_FILE, 'utf-8')
        if (!existing.includes('Claude Task Manager')) {
          return {
            success: false,
            error: `${HOOK_FILE} に既存の stop.sh が存在します。手動でバックアップしてから再実行してください。`
          }
        }
      }
      fs.mkdirSync(HOOK_INSTALL_DIR, { recursive: true })
      fs.writeFileSync(HOOK_FILE, HOOK_CONTENT, { encoding: 'utf-8', mode: 0o755 })
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  uninstallHook(): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(HOOK_FILE)) {
        return { success: true }
      }
      const existing = fs.readFileSync(HOOK_FILE, 'utf-8')
      if (!existing.includes('Claude Task Manager')) {
        return {
          success: false,
          error: `${HOOK_FILE} はこのアプリが管理するファイルではないため削除できません。`
        }
      }
      fs.unlinkSync(HOOK_FILE)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  getHookStatus(): { installed: boolean; path: string; managedByApp: boolean } {
    const exists = fs.existsSync(HOOK_FILE)
    let managedByApp = false
    if (exists) {
      try {
        const content = fs.readFileSync(HOOK_FILE, 'utf-8')
        managedByApp = content.includes('Claude Task Manager')
      } catch {
        // ignore
      }
    }
    return { installed: exists, path: HOOK_FILE, managedByApp }
  }

  stop(): void {
    this.server?.close()
    this.server = null
    try {
      if (fs.existsSync(PORT_FILE)) {
        fs.unlinkSync(PORT_FILE)
      }
    } catch {
      // ignore
    }
  }
}
