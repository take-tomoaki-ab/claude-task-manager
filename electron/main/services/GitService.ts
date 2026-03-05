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

  async checkout(workdir: string, branch: string, baseBranch?: string): Promise<void> {
    const git = simpleGit(workdir)
    const branches = await git.branchLocal()
    if (branches.all.includes(branch)) {
      // ローカルに存在 → そのまま切り替え
      await git.checkout(branch)
    } else if (baseBranch) {
      // baseBranch から新規作成
      await git.checkoutBranch(branch, baseBranch)
    } else {
      // 現在のHEADから新規作成
      await git.checkoutLocalBranch(branch)
    }
  }

  async branches(workdir: string): Promise<string[]> {
    try {
      const git = simpleGit(workdir)
      const result = await git.branch(['-a'])
      const names = new Set<string>()
      for (const name of result.all) {
        // remotes/origin/HEAD などは除外
        if (name.includes('HEAD')) continue
        if (name.startsWith('remotes/origin/')) {
          names.add(name.replace('remotes/origin/', ''))
        } else {
          names.add(name)
        }
      }
      return Array.from(names).sort()
    } catch {
      return []
    }
  }
}
