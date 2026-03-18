import * as pty from 'node-pty'

export type TerminalDataCallback = (data: string) => void

export class TerminalService {
  private sessions: Map<string, pty.IPty> = new Map()
  private dataListeners: Map<string, Set<TerminalDataCallback>> = new Map()

  start(taskId: string, workdir: string, cols = 120, rows = 30, extraEnv?: Record<string, string>): void {
    if (this.sessions.has(taskId)) {
      this.kill(taskId)
    }

    const shell = process.env.SHELL || '/bin/bash'
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      PATH: `/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
      ...extraEnv
    }

    const ptyProcess = pty.spawn(shell, ['-l'], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: workdir,
      env
    })

    this.sessions.set(taskId, ptyProcess)

    ptyProcess.onData((data) => {
      const listeners = this.dataListeners.get(taskId)
      if (listeners) {
        for (const cb of listeners) {
          cb(data)
        }
      }
    })

    ptyProcess.onExit(() => {
      this.sessions.delete(taskId)
    })
  }

  write(taskId: string, data: string): void {
    const session = this.sessions.get(taskId)
    if (!session) {
      throw new Error(`No terminal session for task: ${taskId}`)
    }
    session.write(data)
  }

  kill(taskId: string): void {
    const session = this.sessions.get(taskId)
    if (session) {
      session.kill()
      this.sessions.delete(taskId)
      this.dataListeners.delete(taskId)
    }
  }

  resize(taskId: string, cols: number, rows: number): void {
    const session = this.sessions.get(taskId)
    if (session) {
      session.resize(cols, rows)
    }
  }

  onData(taskId: string, callback: TerminalDataCallback): () => void {
    if (!this.dataListeners.has(taskId)) {
      this.dataListeners.set(taskId, new Set())
    }
    this.dataListeners.get(taskId)!.add(callback)

    return () => {
      const listeners = this.dataListeners.get(taskId)
      if (listeners) {
        listeners.delete(callback)
      }
    }
  }

  getPid(taskId: string): number | undefined {
    const session = this.sessions.get(taskId)
    return session?.pid
  }

  killAll(): void {
    for (const [taskId] of this.sessions) {
      this.kill(taskId)
    }
  }
}
