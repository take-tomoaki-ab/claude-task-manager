import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ArchiveEntry } from '../types/task'
import ConfirmDialog from '../components/Common/ConfirmDialog'

export default function ArchivePage() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<ArchiveEntry[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false)

  const fetchArchives = async () => {
    const archived = await window.api.tasks.listArchived()
    setEntries(archived.sort((a, b) => b.archived_at.localeCompare(a.archived_at)))
  }

  useEffect(() => {
    fetchArchives()
  }, [])

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await window.api.tasks.deleteArchived(deleteTarget)
    setDeleteTarget(null)
    await fetchArchives()
  }

  const handleDeleteAll = async () => {
    await window.api.tasks.deleteAllArchived()
    setDeleteAllConfirm(false)
    await fetchArchives()
  }

  const TYPE_COLORS: Record<string, string> = {
    feat: 'bg-blue-600',
    design: 'bg-purple-600',
    review: 'bg-yellow-600',
    bugfix: 'bg-green-600',
    research: 'bg-cyan-600',
    chore: 'bg-gray-600'
  }

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h1 className="text-lg font-semibold text-white">アーカイブ</h1>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => setDeleteAllConfirm(true)}
              className="px-3 py-1.5 rounded bg-red-700 hover:bg-red-600 text-sm text-white"
            >
              全て削除
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-300"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {entries.length === 0 && (
          <p className="text-gray-500 text-center mt-8">アーカイブされたタスクはありません</p>
        )}
        {entries.map((entry) => {
          const task = entry.task_data
          const isExpanded = expanded.has(entry.id)
          return (
            <div key={entry.id} className="bg-gray-800 rounded-lg mb-3 shadow">
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-750"
                onClick={() => toggleExpand(entry.id)}
              >
                <span className="text-gray-500 text-xs">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                <span className={`text-xs px-2 py-0.5 rounded text-white ${TYPE_COLORS[task.type]}`}>
                  {task.type}
                </span>
                <span className="text-sm text-white flex-1 truncate">{task.title}</span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.archived_at).toLocaleString('ja-JP')}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(entry.id)
                  }}
                  className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  削除
                </button>
              </div>
              {isExpanded && (
                <div className="px-4 pb-3 text-xs text-gray-400 space-y-1 border-t border-gray-700 pt-2">
                  <p>Pane: {task.pane}</p>
                  {'branch' in task && <p>Branch: {(task as { branch: string }).branch}</p>}
                  {'ticket' in task && <p>Ticket: {(task as { ticket: string }).ticket}</p>}
                  {'url' in task && <p>PR: {(task as { url: string }).url}</p>}
                  {task.prompt && <p>Prompt: {task.prompt}</p>}
                  {task.startedAt && <p>開始: {new Date(task.startedAt).toLocaleString('ja-JP')}</p>}
                  {task.completedAt && <p>完了: {new Date(task.completedAt).toLocaleString('ja-JP')}</p>}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="アーカイブ削除"
        message="このアーカイブを完全に削除しますか？この操作は元に戻せません。"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        isOpen={deleteAllConfirm}
        title="アーカイブ全件削除"
        message={`アーカイブ全${entries.length}件を完全に削除しますか？この操作は元に戻せません。`}
        onConfirm={handleDeleteAll}
        onCancel={() => setDeleteAllConfirm(false)}
      />
    </div>
  )
}
