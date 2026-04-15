type Props = {
  prStatus?: 'open' | 'draft' | 'merged' | 'closed'
}

export default function PRStatusBadge({ prStatus }: Props) {
  if (!prStatus) return null

  const colors: Record<string, string> = {
    open: 'bg-green-600',
    draft: 'bg-gray-500',
    merged: 'bg-purple-600',
    closed: 'bg-red-600'
  }

  return (
    <span className={`text-xs px-2 py-0.5 rounded text-white ${colors[prStatus] || 'bg-gray-600'}`}>
      {prStatus}
    </span>
  )
}
