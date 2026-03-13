import { useState } from 'react'
import type { RuntimeTask } from '../../types/task'
import { useTaskStore } from '../../stores/taskStore'
import { useTerminalStore } from '../../stores/terminalStore'
import ContextMeter from '../ContextMeter/ContextMeter'
import BranchStatus from '../BranchStatus/BranchStatus'
import PRStatusBadge from './PRStatusBadge'

type Props = {
  task: RuntimeTask
  hasFreePane?: boolean
  onEdit?: (task: RuntimeTask) => void
}

const TYPE_COLORS: Record<string, string> = {
  feat: 'bg-blue-600',
  design: 'bg-purple-600',
  review: 'bg-yellow-600',
  bugfix: 'bg-green-600',
  research: 'bg-cyan-600',
  chore: 'bg-gray-600'
}

function DoneDetail({ task }: { task: RuntimeTask }) {
  const [open, setOpen] = useState(false)

  const rows: { label: string; value: string }[] = []
  if ('branch' in task && task.branch) rows.push({ label: 'ブランチ', value: task.branch })
  if ('baseBranch' in task && task.baseBranch) rows.push({ label: '分岐元', value: task.baseBranch })
  if ('ticket' in task && task.ticket) rows.push({ label: 'Wrike', value: task.ticket })
  if ('url' in task && task.url) rows.push({ label: 'PR URL', value: task.url })
  if ('output' in task && task.output) rows.push({ label: '出力先', value: task.output })
  if ('directory' in task && task.directory) rows.push({ label: 'Dir', value: task.directory })
  if (task.prompt) rows.push({ label: 'プロンプト', value: task.prompt })

  if (rows.length === 0) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-xs text-gray-400 hover:text-gray-200 flex items-center gap-1"
      >
        <span>{open ? '▾' : '▸'}</span>
        詳細
      </button>
      {open && (
        <div className="mt-1 space-y-1 text-xs bg-gray-900/60 rounded p-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="flex gap-2">
              <span className="text-gray-500 shrink-0 w-16">{label}</span>
              <span className="text-gray-300 break-all">{value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TaskCard({ task, hasFreePane = true, onEdit }: Props) {
  const tasks = useTaskStore((s) => s.tasks)
  const startTask = useTaskStore((s) => s.startTask)
  const updateTask = useTaskStore((s) => s.updateTask)
  const archiveTask = useTaskStore((s) => s.archiveTask)
  const openTerminal = useTerminalStore((s) => s.openTerminal)

  const activeTaskId = useTerminalStore((s) => s.activeTaskId)
  const isTerminalOpen = useTerminalStore((s) => s.isOpen)
  const isHighlighted = isTerminalOpen && activeTaskId === task.id

  const [startError, setStartError] = useState<string | null>(null)

  const depTask = task.depends_on ? tasks.find((t) => t.id === task.depends_on) : null
  const depBlocked = depTask ? depTask.status !== 'done' : false
  const paneBlocked = task.type !== 'chore' && !hasFreePane

  const handleStart = async () => {
    setStartError(null)
    try {
      await startTask(task.id)
    } catch (err) {
      setStartError((err as Error).message)
    }
  }

  const handleComplete = async () => {
    await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() })
    const { activeTaskId, closeTerminal } = useTerminalStore.getState()
    if (activeTaskId === task.id) closeTerminal()
  }

  const handleArchive = async () => {
    await archiveTask(task.id)
  }

  const handleRevert = async () => {
    await updateTask(task.id, { status: 'will_do', completedAt: null, startedAt: null })
  }

  const openLink = (url: string) => {
    window.api.shell.openExternal(url)
  }

  return (
    <>
      <div className={`rounded-lg p-4 shadow mb-3 backdrop-blur-sm transition-all duration-200 ${
        isHighlighted
          ? 'bg-blue-900/60 ring-2 ring-blue-400/70'
          : 'bg-gray-800/55'
      }`}>
        {/* Type badge + Title */}
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-2 py-0.5 rounded text-white font-medium ${TYPE_COLORS[task.type]}`}>
            {task.type}
          </span>
          <span className="text-sm font-medium text-white truncate" title={task.title}>{task.title}</span>
        </div>

        {/* will_do card */}
        {task.status === 'will_do' && (
          <div>
            {depTask && (
              <p className="text-xs text-gray-400 mb-2">
                依存: {depTask.title} ({depTask.status})
              </p>
            )}

            {startError && (
              <p className="text-xs text-red-400 mb-2 break-all">{startError}</p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={handleStart}
                disabled={depBlocked || paneBlocked}
                className={`px-3 py-1 rounded text-xs font-medium ${
                  depBlocked || paneBlocked
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
                title={
                  depBlocked ? '依存タスクが未完了です' :
                  paneBlocked ? '空きペインがありません' :
                  undefined
                }
              >
                開始
              </button>
              <button
                onClick={handleComplete}
                className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
                title="実行せずに完了にする"
              >
                完了
              </button>
              {onEdit && (
                <button
                  onClick={() => onEdit(task)}
                  className="px-3 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  編集
                </button>
              )}

              {task.type === 'feat' && 'ticket' in task && task.ticket && (
                <button
                  onClick={() => openLink(task.ticket)}
                  className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Wrike
                </button>
              )}
              {task.type === 'bugfix' && 'ticket' in task && task.ticket && (
                <button
                  onClick={() => openLink(task.ticket)}
                  className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Wrike
                </button>
              )}
              {task.type === 'review' && 'url' in task && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openLink(task.url)}
                    className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    PR
                  </button>
                  <PRStatusBadge url={task.url} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* doing card */}
        {task.status === 'doing' && (
          <div className="space-y-2">
            <div className="text-xs text-gray-400">
              Pane: <span className="text-gray-300 font-mono">{task.pane}</span>
              {task.workdir && (
                <span className="text-gray-500"> → {task.workdir}</span>
              )}
            </div>

            {task.type !== 'chore' && task.workdir && (
              <BranchStatus workdir={task.workdir} />
            )}
            {task.type === 'chore' && 'directory' in task && (
              <div className="text-xs text-gray-400">
                Dir: <span className="font-mono text-gray-300">{task.directory}</span>
              </div>
            )}

            <ContextMeter
              taskId={task.id}
              used={task.contextUsed}
              limit={task.contextLimit}
            />

            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => openTerminal(task.id)}
                className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                対話を開く
              </button>
              <button
                onClick={handleComplete}
                className="px-3 py-1 rounded text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                完了
              </button>
              {(task.type === 'feat' || task.type === 'bugfix') && 'ticket' in task && task.ticket && (
                <button
                  onClick={() => openLink(task.ticket)}
                  className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Wrike
                </button>
              )}
              {task.type === 'review' && 'url' in task && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openLink(task.url)}
                    className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    PR
                  </button>
                  <PRStatusBadge url={task.url} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* done card */}
        {task.status === 'done' && (
          <div>
            {task.completedAt && (
              <p className="text-xs text-gray-500 mb-2">
                完了: {new Date(task.completedAt).toLocaleString('ja-JP')}
              </p>
            )}
            <DoneDetail task={task} />
            <div className="flex items-center gap-2 mt-2">
              {task.type === 'review' && 'url' in task && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openLink(task.url)}
                    className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    PR
                  </button>
                  <PRStatusBadge url={task.url} />
                </div>
              )}
              {(task.type === 'feat' || task.type === 'bugfix') && 'ticket' in task && task.ticket && (
                <button
                  onClick={() => openLink(task.ticket)}
                  className="px-2 py-1 rounded text-xs bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Wrike
                </button>
              )}
              <button
                onClick={handleArchive}
                className="px-3 py-1 rounded text-xs bg-gray-600 hover:bg-gray-500 text-gray-300"
              >
                アーカイブ
              </button>
              <button
                onClick={handleRevert}
                className="px-3 py-1 rounded text-xs bg-yellow-700 hover:bg-yellow-600 text-white"
              >
                未実行に戻す
              </button>
            </div>
          </div>
        )}
      </div>

    </>
  )
}
