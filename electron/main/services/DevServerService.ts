import { spawn, type ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import type { DevServerConfig, PaneConfig, DevServerStatus } from '../../../src/types/ipc'
import { expandPath } from '../utils/path'

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

    const resolvedPath = expandPath(paneConfig.path)
    this.configs.set(k, { paneConfig, serverConfig })
    this.logs.set(k, '')

    if (!existsSync(resolvedPath)) {
      this.logs.set(k, `[error] ディレクトリが存在しません: ${resolvedPath}\n設定画面でpaneのパスを確認してください。\n`)
      this.notifyChange()
      return
    }

    // Electronはシェルの環境を継承しないためhomebrew等がPATHに入らない。
    // -l（ログインシェル）は .zprofile 等でexit/execが走り即終了するリスクがあるため
    // 使わず、PATHを明示的に補強して -c でコマンドを実行する。
    const userShell = process.env.SHELL || '/bin/bash'
    const cmdString = [serverConfig.command, ...serverConfig.args].join(' ')
    const env = {
      ...process.env,
      PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`
    }

    const child = spawn(userShell, ['-c', cmdString], {
      cwd: resolvedPath,
      env,
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

    child.on('error', (err) => {
      const current = this.logs.get(k) || ''
      this.logs.set(k, current + `[error] ${err.message}\n`)
      this.processes.delete(k)
      this.notifyChange()
    })

    child.on('exit', (code, signal) => {
      const current = this.logs.get(k) || ''
      this.logs.set(k, current + `\n[exited: code=${code} signal=${signal}]\n`)
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
