import simpleGit from 'simple-git'
import type { GitStatusResult } from '../../../src/types/ipc'

export class GitService {
  async status(workdir: string): Promise<GitStatusResult> {
    try {
      const git = simpleGit(workdir)
      const statusResult = await git.status()

      let ahead = 0
      let behind = 0
      try {
        const branchInfo = await git.branch()
        const current = branchInfo.current
        const tracking = branchInfo.branches[current]?.label
        if (tracking && current) {
          const remote = `origin/${current}`
          try {
            const log = await git.log({ from: remote, to: 'HEAD' })
            ahead = log.total
            const logBehind = await git.log({ from: 'HEAD', to: remote })
            behind = logBehind.total
          } catch {
            // Remote branch may not exist
          }
        }
      } catch {
        // No remote tracking branch
      }

      return {
        branch: statusResult.current || 'HEAD',
        ahead,
        behind,
        modified: statusResult.files.length
      }
    } catch (error) {
      return {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        modified: 0,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async checkout(workdir: string, branch: string): Promise<void> {
    const git = simpleGit(workdir)
    try {
      await git.checkout(branch)
    } catch {
      // ローカルにブランチがなければ fetch して再試行（Git DWIMでリモート追跡ブランチを作成）
      await git.fetch('origin')
      await git.checkout(branch)
    }
  }
}
