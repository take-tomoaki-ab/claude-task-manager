import { useState, useEffect } from 'react'
import type { TaskType, RuntimeTask } from '../../types/task'
import { useTaskStore } from '../../stores/taskStore'

type Props = {
  isOpen: boolean
  onClose: () => void
  editTask?: RuntimeTask  // 指定時は編集モード
}

const INITIAL_FORM = {
  type: 'feat' as TaskType,
  title: '',
  branch: '',
  baseBranch: '',
  ticket: '',
  prompt: '',
  depends_on: '',
  url: '',
  output: '',
  directory: ''
}

function taskToForm(task: RuntimeTask) {
  return {
    type: task.type,
    title: task.title,
    depends_on: task.depends_on ?? '',
    branch: 'branch' in task ? (task.branch ?? '') : '',
    baseBranch: ('baseBranch' in task ? (task.baseBranch ?? '') : '') as string,
    ticket: 'ticket' in task ? (task.ticket ?? '') : '',
    prompt: task.prompt ?? '',
    url: 'url' in task ? (task.url ?? '') : '',
    output: 'output' in task ? (task.output ?? '') : '',
    directory: 'directory' in task ? (task.directory ?? '') : ''
  }
}

export default function TaskForm({ isOpen, onClose, editTask }: Props) {
  const [form, setForm] = useState(INITIAL_FORM)
  const [availableBranches, setAvailableBranches] = useState<string[]>([])
  const tasks = useTaskStore((s) => s.tasks)
  const createTask = useTaskStore((s) => s.createTask)
  const updateTask = useTaskStore((s) => s.updateTask)

  useEffect(() => {
    if (isOpen) {
      setForm(editTask ? taskToForm(editTask) : INITIAL_FORM)
      // フォームが開いたらブランチ一覧を取得（最初のペインから）
      window.api.settings.get().then((settings) => {
        const firstPane = settings.panes[0]
        if (firstPane?.path) {
          window.api.git.branches(firstPane.path).then(setAvailableBranches).catch(() => {})
        }
      })
    }
  }, [isOpen, editTask])

  if (!isOpen) return null

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title) return

    if (editTask) {
      // 編集モード: タイトル・depends_on と型別フィールドを更新
      const common = {
        title: form.title,
        depends_on: form.depends_on || undefined,
        prompt: form.prompt || undefined,
        branch: form.branch || undefined,
        baseBranch: form.baseBranch || undefined,
        ticket: form.ticket || undefined,
        url: form.url || undefined,
        output: form.output || undefined,
        directory: form.directory || undefined,
      }
      await updateTask(editTask.id, common)
    } else {
      // 新規作成モード: pane は開始時に自動割り当てなので空文字で作成
      const base = {
        title: form.title,
        pane: '',
        status: 'will_do' as const,
        ...(form.depends_on ? { depends_on: form.depends_on } : {})
      }
      switch (form.type) {
        case 'feat':
          await createTask({ ...base, type: 'feat', branch: form.branch, baseBranch: form.baseBranch || undefined, ticket: form.ticket, prompt: form.prompt })
          break
        case 'design':
          await createTask({ ...base, type: 'design', output: form.output, prompt: form.prompt || undefined })
          break
        case 'review':
          await createTask({ ...base, type: 'review', url: form.url, prompt: form.prompt || undefined })
          break
        case 'qa':
          await createTask({ ...base, type: 'qa', branch: form.branch, baseBranch: form.baseBranch || undefined, ticket: form.ticket, prompt: form.prompt || undefined })
          break
        case 'research':
          await createTask({ ...base, type: 'research', branch: form.branch, prompt: form.prompt })
          break
        case 'chore':
          await createTask({ ...base, type: 'chore', directory: form.directory, prompt: form.prompt || undefined })
          break
      }
    }
    onClose()
  }

  const inputClass = 'w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'
  const labelClass = 'block text-xs text-gray-400 mb-1'
  const req = <span className="text-red-400 ml-1">*</span>

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit} className="p-6">
          <h2 className="text-lg font-semibold text-white mb-4">{editTask ? 'タスクを編集' : '新規タスク'}</h2>

          <div className="space-y-3">
            {/* Type */}
            <div>
              <label className={labelClass}>タイプ</label>
              {editTask ? (
                <div className={`${inputClass} text-gray-400 cursor-not-allowed`}>{form.type}</div>
              ) : (
                <select
                  value={form.type}
                  onChange={(e) => set('type', e.target.value)}
                  className={inputClass}
                >
                  <option value="feat">feat</option>
                  <option value="design">design</option>
                  <option value="review">review</option>
                  <option value="qa">qa</option>
                  <option value="research">research</option>
                  <option value="chore">chore</option>
                </select>
              )}
            </div>

            {/* Title */}
            <div>
              <label className={labelClass}>タイトル{req}</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="タスクタイトル"
                className={inputClass}
                required
              />
            </div>

            {/* Type-specific fields */}
            {(form.type === 'feat' || form.type === 'qa' || form.type === 'research') && (
              <div>
                <label className={labelClass}>Branch{req}</label>
                <input
                  type="text"
                  value={form.branch}
                  onChange={(e) => set('branch', e.target.value)}
                  placeholder="take/feature-name"
                  className={inputClass}
                  required
                />
              </div>
            )}

            {(form.type === 'feat' || form.type === 'qa') && (
              <div>
                <label className={labelClass}>分岐元ブランチ</label>
                <select
                  value={form.baseBranch}
                  onChange={(e) => set('baseBranch', e.target.value)}
                  className={inputClass}
                >
                  <option value="">現在のHEADから分岐</option>
                  {availableBranches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            )}

            {(form.type === 'feat' || form.type === 'qa') && (
              <div>
                <label className={labelClass}>Wrike Ticket URL{req}</label>
                <input
                  type="text"
                  value={form.ticket}
                  onChange={(e) => set('ticket', e.target.value)}
                  placeholder="https://www.wrike.com/..."
                  className={inputClass}
                  required
                />
              </div>
            )}

            <div>
              <label className={labelClass}>
                Prompt{(form.type === 'feat' || form.type === 'research') && req}
              </label>
              <textarea
                value={form.prompt}
                onChange={(e) => set('prompt', e.target.value)}
                placeholder="Claude Codeへの指示..."
                rows={3}
                className={inputClass}
                required={form.type === 'feat' || form.type === 'research'}
              />
            </div>

            {form.type === 'design' && (
              <div>
                <label className={labelClass}>Output{req}</label>
                <input
                  type="text"
                  value={form.output}
                  onChange={(e) => set('output', e.target.value)}
                  placeholder="出力先ファイル"
                  className={inputClass}
                  required
                />
              </div>
            )}

            {form.type === 'review' && (
              <div>
                <label className={labelClass}>PR URL{req}</label>
                <input
                  type="text"
                  value={form.url}
                  onChange={(e) => set('url', e.target.value)}
                  placeholder="https://github.com/..."
                  className={inputClass}
                  required
                />
              </div>
            )}

            {form.type === 'chore' && (
              <div>
                <label className={labelClass}>Directory{req}</label>
                <input
                  type="text"
                  value={form.directory}
                  onChange={(e) => set('directory', e.target.value)}
                  placeholder="/path/to/directory"
                  className={inputClass}
                  required
                />
              </div>
            )}

            {/* Depends on */}
            <div>
              <label className={labelClass}>依存タスク</label>
              <select
                value={form.depends_on}
                onChange={(e) => set('depends_on', e.target.value)}
                className={inputClass}
              >
                <option value="">なし</option>
                {tasks.filter((t) => t.id !== editTask?.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    [{t.type}] {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
            >
              {editTask ? '保存' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
