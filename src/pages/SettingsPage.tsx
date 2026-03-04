import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppSettings, PaneConfig, DevServerConfig } from '../types/ipc'
import ConfirmDialog from '../components/Common/ConfirmDialog'

// args配列 ↔ テキスト変換をonBlurで行うinput
function ArgsInput({
  value,
  onChange,
  className,
  placeholder
}: {
  value: string[]
  onChange: (args: string[]) => void
  className?: string
  placeholder?: string
}) {
  const [text, setText] = useState(value.join(' '))

  // 外部からvalueが変わった場合に同期（初期表示のみ）
  useEffect(() => {
    setText(value.join(' '))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <input
      type="text"
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onChange(text.split(/\s+/).filter(Boolean))}
      placeholder={placeholder}
      className={className}
    />
  )
}

const TASK_TYPES = ['feat', 'design', 'review', 'qa', 'research', 'chore'] as const

type DeleteTarget =
  | { kind: 'pane'; paneIndex: number }
  | { kind: 'devserver'; paneIndex: number; dsIndex: number }

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AppSettings>({ panes: [], promptTemplates: {} })
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
  }, [])

  const updatePane = (index: number, updates: Partial<PaneConfig>) => {
    setSettings((prev) => {
      const panes = [...prev.panes]
      panes[index] = { ...panes[index], ...updates }
      return { ...prev, panes }
    })
  }

  const addPane = () => {
    setSettings((prev) => ({
      ...prev,
      panes: [...prev.panes, { id: '', path: '', devServers: [] }]
    }))
  }

  const removePane = (index: number) => {
    setDeleteTarget({ kind: 'pane', paneIndex: index })
  }

  const updateDevServer = (paneIndex: number, dsIndex: number, updates: Partial<DevServerConfig>) => {
    setSettings((prev) => {
      const panes = [...prev.panes]
      const devServers = [...panes[paneIndex].devServers]
      devServers[dsIndex] = { ...devServers[dsIndex], ...updates }
      panes[paneIndex] = { ...panes[paneIndex], devServers }
      return { ...prev, panes }
    })
  }

  const addDevServer = (paneIndex: number) => {
    setSettings((prev) => {
      const panes = [...prev.panes]
      panes[paneIndex] = {
        ...panes[paneIndex],
        devServers: [...panes[paneIndex].devServers, { label: '', command: '', args: [] }]
      }
      return { ...prev, panes }
    })
  }

  const removeDevServer = (paneIndex: number, dsIndex: number) => {
    setDeleteTarget({ kind: 'devserver', paneIndex, dsIndex })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'pane') {
      setSettings((prev) => ({
        ...prev,
        panes: prev.panes.filter((_, i) => i !== deleteTarget.paneIndex)
      }))
    } else {
      setSettings((prev) => {
        const panes = [...prev.panes]
        panes[deleteTarget.paneIndex] = {
          ...panes[deleteTarget.paneIndex],
          devServers: panes[deleteTarget.paneIndex].devServers.filter((_, i) => i !== deleteTarget.dsIndex)
        }
        return { ...prev, panes }
      })
    }
    setDeleteTarget(null)
  }

  const handleSave = async () => {
    setSaving(true)
    await window.api.settings.set(settings)
    setSaving(false)
  }

  const inputClass = 'px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500'

  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h1 className="text-lg font-semibold text-white">設定</h1>
        <button
          onClick={() => navigate('/')}
          className="px-3 py-1.5 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-300"
        >
          ダッシュボードに戻る
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Pane Settings */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-300">Pane マッピング</h2>
            <button
              onClick={addPane}
              className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white"
            >
              + Pane追加
            </button>
          </div>

          {settings.panes.map((pane, pi) => (
            <div key={pi} className="bg-gray-800 rounded-lg p-4 mb-3">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="text"
                  value={pane.id}
                  onChange={(e) => updatePane(pi, { id: e.target.value })}
                  placeholder="Pane ID (例: p1)"
                  className={`${inputClass} w-32`}
                />
                <input
                  type="text"
                  value={pane.path}
                  onChange={(e) => updatePane(pi, { path: e.target.value })}
                  placeholder="絶対パス"
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={() => removePane(pi)}
                  className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  削除
                </button>
              </div>

              {/* Dev Servers */}
              <div className="pl-4 border-l-2 border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">Dev Servers</span>
                  <button
                    onClick={() => addDevServer(pi)}
                    className="px-2 py-0.5 rounded text-xs bg-gray-600 hover:bg-gray-500 text-gray-300"
                  >
                    + 追加
                  </button>
                </div>
                {pane.devServers.map((ds, di) => (
                  <div key={di} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      value={ds.label}
                      onChange={(e) => updateDevServer(pi, di, { label: e.target.value })}
                      placeholder="Label"
                      className={`${inputClass} w-24`}
                    />
                    <input
                      type="text"
                      value={ds.command}
                      onChange={(e) => updateDevServer(pi, di, { command: e.target.value })}
                      placeholder="Command"
                      className={`${inputClass} w-24`}
                    />
                    <ArgsInput
                      value={ds.args}
                      onChange={(args) => updateDevServer(pi, di, { args })}
                      placeholder="Args (space sep)"
                      className={`${inputClass} flex-1`}
                    />
                    <input
                      type="number"
                      value={ds.port ?? ''}
                      onChange={(e) =>
                        updateDevServer(pi, di, { port: e.target.value ? Number(e.target.value) : undefined })
                      }
                      placeholder="Port"
                      className={`${inputClass} w-20`}
                    />
                    <button
                      onClick={() => removeDevServer(pi, di)}
                      className="px-2 py-0.5 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Claude 起動オプション */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Claude Code 起動オプション</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.useDangerouslySkipPermissions ?? false}
              onChange={(e) => setSettings((prev) => ({ ...prev, useDangerouslySkipPermissions: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-300">
              <span className="font-mono text-yellow-400">--dangerously-skip-permissions</span> で起動する
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">有効にするとパーミッション確認なしで Claude が操作を実行します</p>
        </section>

        {/* プロンプトテンプレート */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">プロンプトテンプレート（タスクタイプ別）</h2>
          <p className="text-xs text-gray-500 mb-3">
            タスク開始時に自動送信される初期プロンプト。タスク個別の prompt が優先されます。
            <br />
            <span className="text-gray-400"><span className="font-mono text-blue-400">{'{title}'}</span> はすべてのタイプで使用可能です。</span>
          </p>
          <div className="space-y-3">
            {TASK_TYPES.map((type) => {
              const hints: Record<string, string[]> = {
                feat: ['{branch}', '{ticket}', '{prompt}'],
                design: ['{output}'],
                review: ['{pr-url}'],
                qa: ['{branch}', '{ticket}'],
                research: ['{branch}', '{prompt}'],
                chore: ['{directory}'],
              }
              return (
                <div key={type}>
                  <div className="flex items-center gap-2 mb-1">
                    <label className="text-xs text-gray-400 font-mono">{type}</label>
                    <span className="text-xs text-gray-600">
                      {hints[type].map((v) => (
                        <span key={v} className="font-mono text-blue-500 mr-1">{v}</span>
                      ))}
                    </span>
                  </div>
                  <textarea
                    value={settings.promptTemplates?.[type] ?? ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        promptTemplates: { ...prev.promptTemplates, [type]: e.target.value }
                      }))
                    }
                    placeholder={`${type} タスクの初期プロンプト`}
                    rows={2}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-y font-mono"
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* GitHub PAT */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">GitHub Personal Access Token</h2>
          <input
            type="password"
            value={settings.githubPat ?? ''}
            onChange={(e) => setSettings((prev) => ({ ...prev, githubPat: e.target.value }))}
            placeholder="ghp_xxxxxxxxxxxx"
            className={`${inputClass} w-full max-w-md`}
          />
          <p className="text-xs text-gray-500 mt-1">PR ステータス取得に使用（暗号化して保存）</p>
        </section>

        {/* 背景画像スライドショー */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">背景画像スライドショー</h2>
          <p className="text-xs text-gray-500 mb-3">指定ディレクトリ内の画像を一定間隔で背景表示します。</p>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.backgroundImageDir ?? ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, backgroundImageDir: e.target.value }))}
                placeholder="画像ディレクトリのパス"
                className={`${inputClass} flex-1`}
              />
              <button
                onClick={async () => {
                  const dir = await window.api.dialog.openDirectory()
                  if (dir) setSettings((prev) => ({ ...prev, backgroundImageDir: dir }))
                }}
                className="px-3 py-1.5 rounded text-sm bg-gray-600 hover:bg-gray-500 text-gray-200 whitespace-nowrap"
              >
                フォルダ選択
              </button>
              {settings.backgroundImageDir && (
                <button
                  onClick={() => setSettings((prev) => ({ ...prev, backgroundImageDir: undefined }))}
                  className="px-3 py-1.5 rounded text-sm bg-red-600 hover:bg-red-700 text-white"
                >
                  解除
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 whitespace-nowrap">切替間隔（秒）</label>
              <input
                type="number"
                min={5}
                value={settings.backgroundIntervalSec ?? 30}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, backgroundIntervalSec: Number(e.target.value) || 30 }))
                }
                className={`${inputClass} w-24`}
              />
            </div>
          </div>
        </section>

        {/* Save */}
        <div className="pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="削除の確認"
        message={
          deleteTarget?.kind === 'pane'
            ? `Pane「${settings.panes[deleteTarget.paneIndex]?.id || ''}」を削除しますか？`
            : `Dev Server「${settings.panes[deleteTarget?.paneIndex ?? 0]?.devServers[deleteTarget?.dsIndex ?? 0]?.label || ''}」を削除しますか？`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
