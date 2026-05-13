import http from 'http'
import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const PORT_FILE_DIR = path.join(homedir(), '.claude-task-manager')
const PORT_FILE = path.join(PORT_FILE_DIR, 'port')

type RouteHandler = (body: string, res: http.ServerResponse) => void

export class LocalHttpServer {
  private server: http.Server | null = null
  private port = 0
  private routes = new Map<string, RouteHandler>()

  addRoute(routePath: string, handler: RouteHandler): void {
    this.routes.set(routePath, handler)
  }

  async start(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(404)
          res.end('not found')
          return
        }
        const handler = this.routes.get(req.url ?? '')
        if (!handler) {
          res.writeHead(404)
          res.end('not found')
          return
        }
        let body = ''
        req.on('data', (chunk) => { body += chunk })
        req.on('end', () => {
          try {
            handler(body, res)
          } catch {
            res.writeHead(500)
            res.end('internal error')
          }
        })
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
          console.log(`[LocalHttpServer] listening on port ${this.port}`)
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
