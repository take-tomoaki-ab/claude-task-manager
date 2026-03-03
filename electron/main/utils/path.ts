import { homedir } from 'os'

/**
 * ~をホームディレクトリに展開する。
 * Node.jsのspawn/existsSyncは~を自動展開しないため必要。
 */
export function expandPath(p: string): string {
  if (p.startsWith('~/') || p === '~') {
    return homedir() + p.slice(1)
  }
  return p
}
