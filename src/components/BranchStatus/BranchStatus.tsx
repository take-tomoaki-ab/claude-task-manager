import { useState, useEffect } from 'react'
import type { GitStatusResult } from '../../types/ipc'

type Props = {
  workdir: string
}

export default function BranchStatus({ workdir }: Props) {
  const [status, setStatus] = useState<GitStatusResult | null>(null)

  useEffect(() => {
    if (!workdir) return

    const fetchStatus = async () => {
      try {
        const result = await window.api.git.status(workdir)
        setStatus(result)
      } catch {
        setStatus(null)
      }
    }

    fetchStatus()
    const interval = setInterval(fetchStatus, 5000)
    return () => clearInterval(interval)
  }, [workdir])

  if (!status || status.error) {
    return <span className="text-gray-500 text-xs">branch info unavailable</span>
  }

  return (
    <span className="text-xs text-gray-300 font-mono">
      {status.branch}{' '}
      <span className="text-green-400">↑{status.ahead}</span>{' '}
      <span className="text-red-400">↓{status.behind}</span>
      {status.modified > 0 && (
        <span className="text-yellow-400"> (未コミット: {status.modified}ファイル)</span>
      )}
    </span>
  )
}
