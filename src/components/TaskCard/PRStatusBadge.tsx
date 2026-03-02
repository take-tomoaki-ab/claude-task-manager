import { useState, useEffect } from 'react'

type Props = {
  url: string
}

type PRState = 'open' | 'merged' | 'closed' | null

function parsePRUrl(url: string): { owner: string; repo: string; number: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
  if (!match) return null
  return { owner: match[1], repo: match[2], number: match[3] }
}

export default function PRStatusBadge({ url }: Props) {
  const [state, setState] = useState<PRState>(null)
  const [loading, setLoading] = useState(true)
  const [noPat, setNoPat] = useState(false)

  useEffect(() => {
    const fetchPRStatus = async () => {
      const parsed = parsePRUrl(url)
      if (!parsed) {
        setLoading(false)
        return
      }

      const settings = await window.api.settings.get()
      if (!settings.githubPat) {
        setNoPat(true)
        setLoading(false)
        return
      }

      try {
        const res = await fetch(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls/${parsed.number}`,
          { headers: { Authorization: `token ${settings.githubPat}` } }
        )
        if (!res.ok) {
          setLoading(false)
          return
        }
        const data = await res.json()
        if (data.merged) {
          setState('merged')
        } else {
          setState(data.state as PRState)
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }

    fetchPRStatus()
  }, [url])

  if (loading) return null

  if (noPat) {
    return (
      <span className="text-xs text-gray-500" title="GitHub PATを設定画面で設定してください">
        PR status unavailable
      </span>
    )
  }

  if (!state) return null

  const colors: Record<string, string> = {
    open: 'bg-green-600',
    merged: 'bg-purple-600',
    closed: 'bg-red-600'
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded text-white ${colors[state] || 'bg-gray-600'}`}>
      {state}
    </span>
  )
}
