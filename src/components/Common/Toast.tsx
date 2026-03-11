import { useEffect } from 'react'

type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type: ToastType
  onClose: () => void
  duration?: number
}

export default function Toast({ message, type, onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [onClose, duration])

  const colors =
    type === 'success'
      ? 'bg-green-800 border-green-600 text-green-100'
      : 'bg-red-800 border-red-600 text-red-100'

  const icon = type === 'success' ? '✓' : '✕'

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm shadow-lg z-50 ${colors}`}
    >
      <span className="font-bold">{icon}</span>
      <span>{message}</span>
    </div>
  )
}
