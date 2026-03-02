import { spawn, type ChildProcess } from 'child_process'
import type { DevServerConfig, PaneConfig, DevServerStatus } from '../../../src/types/ipc'

export type DevServerChangeCallback = (statuses: DevServerStatus[]) => void

export class DevServerService {
  private processes: Map<string, ChildProcess> = new Map()
  private logs: Map<string, string> = new Map()
  private configs: Map<string, { paneConfig: PaneConfig; serverConfig: DevServerConfig }> =
    new Map()
  private changeCallbacks: Set<DevServerChangeCallback> = new Set()

  private key(paneId: string, label: string): string {
    return `${paneId}:${label}`
  }

  start(paneConfig: PaneConfig, serverConfig: DevServerConfig): void {
    const k = this.key(paneConfig.id, serverConfig.label)

    if (this.processes.has(k)) {
      this.stop(paneConfig.id, serverConfig.label)
    }

    this.configs.set(k, { paneConfig, serverConfig })
    this.logs.set(k, '')

    const child = spawn(serverConfig.command, serverConfig.args, {
      cwd: paneConfig.path,
      env: { ...process.env },
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    })

    this.processes.set(k, child)

    child.stdout?.on('data', (data: Buffer) => {
      const current = this.logs.get(k) || ''
      this.logs.set(k, current + data.toString())
    })

    child.stderr?.on('data', (data: Buffer) => {
      const current = this.logs.get(k) || ''
      this.logs.set(k, current + data.toString())
    })

    child.on('exit', () => {
      this.processes.delete(k)
      this.notifyChange()
    })

    this.notifyChange()
  }

  stop(paneId: string, label: string): void {
    const k = this.key(paneId, label)
    const child = this.processes.get(k)
    if (!child) return

    child.kill('SIGTERM')

    setTimeout(() => {
      if (this.processes.has(k)) {
        child.kill('SIGKILL')
        this.processes.delete(k)
        this.notifyChange()
      }
    }, 3000)
  }

  status(): DevServerStatus[] {
    const statuses: DevServerStatus[] = []

    for (const [k, config] of this.configs) {
      const child = this.processes.get(k)
      statuses.push({
        paneId: config.paneConfig.id,
        label: config.serverConfig.label,
        running: !!child,
        pid: child?.pid,
        port: config.serverConfig.port
      })
    }

    return statuses
  }

  getLog(paneId: string, label: string): string {
    return this.logs.get(this.key(paneId, label)) || ''
  }

  onStatusChange(callback: DevServerChangeCallback): () => void {
    this.changeCallbacks.add(callback)
    return () => {
      this.changeCallbacks.delete(callback)
    }
  }

  stopAll(): void {
    for (const [, child] of this.processes) {
      child.kill('SIGTERM')
    }
    setTimeout(() => {
      for (const [k, child] of this.processes) {
        child.kill('SIGKILL')
        this.processes.delete(k)
      }
    }, 3000)
  }

  private notifyChange(): void {
    const statuses = this.status()
    for (const cb of this.changeCallbacks) {
      cb(statuses)
    }
  }
}
