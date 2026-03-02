import type { RuntimeTask } from '../../types/task'

type Props = {
  isOpen: boolean
  conflictingTask: RuntimeTask | null
  onForce: () => void
  onCancel: () => void
}

export default function ConflictWarningModal({ isOpen, conflictingTask, onForce, onCancel }: Props) {
  if (!isOpen || !conflictingTask) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold text-yellow-400 mb-2">Pane 競合警告</h3>
        <p className="text-gray-300 mb-4">
          Pane <span className="font-mono text-white">{conflictingTask.pane}</span> では既に
          タスク「<span className="text-white">{conflictingTask.title}</span>」が実行中です。
        </p>
        <p className="text-gray-400 text-sm mb-6">
          強制起動すると同じpaneで複数のClaude Codeが動作します。続行しますか？
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={onForce}
            className="px-4 py-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
          >
            強制起動
          </button>
        </div>
      </div>
    </div>
  )
}
