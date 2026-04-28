import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppSettings, RepoConfig, PaneConfig, DevServerConfig } from '../types/ipc'
import type { TicketProviderMeta, PluginCatalogEntry } from '../types/plugin'
import ConfirmDialog from '../components/Common/ConfirmDialog'
import Toast from '../components/Common/Toast'

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


const TASK_TYPES = ['feat', 'design', 'review', 'bugfix', 'research', 'chore'] as const

type DeleteTarget =
  | { kind: 'repo'; repoIndex: number }
  | { kind: 'pane'; repoIndex: number; paneIndex: number }
  | { kind: 'devserver'; repoIndex: number; paneIndex: number; dsIndex: number }

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AppSettings>({ repos: [], promptTemplates: {} })
  const [providers, setProviders] = useState<TicketProviderMeta[]>([])
  const [catalog, setCatalog] = useState<PluginCatalogEntry[]>([])
  const [pluginLoading, setPluginLoading] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [prSyncing, setPrSyncing] = useState(false)
  const [prSyncResult, setPrSyncResult] = useState<{ created: number; total: number } | null>(null)
  const [, setImportResult] = useState<'ok' | 'cancelled' | 'error' | null>(null)
  const [hookStatus, setHookStatus] = useState<{ installed: boolean; path: string; managedByApp: boolean; registeredInSettings: boolean } | null>(null)
  const [hookLoading, setHookLoading] = useState(false)

  useEffect(() => {
    window.api.settings.get().then(setSettings)
    window.api.ticket.providers().then(setProviders).catch(() => setProviders([]))
    window.api.ticket.catalog().then(setCatalog).catch(() => setCatalog([]))
    window.api.hooks.status().then(setHookStatus).catch(() => {})
  }, [])

  const updateRepo = (ri: number, updates: Partial<RepoConfig>) => {
    setSettings((prev) => {
      const repos = [...prev.repos]
      repos[ri] = { ...repos[ri], ...updates }
      return { ...prev, repos }
    })
  }

  const addRepo = () => {
    setSettings((prev) => ({
      ...prev,
      repos: [...prev.repos, { id: '', name: '', panes: [] }]
    }))
  }

  const removeRepo = (ri: number) => {
    setDeleteTarget({ kind: 'repo', repoIndex: ri })
  }

  const updatePane = (ri: number, pi: number, updates: Partial<PaneConfig>) => {
    setSettings((prev) => {
      const repos = [...prev.repos]
      const panes = [...repos[ri].panes]
      panes[pi] = { ...panes[pi], ...updates }
      repos[ri] = { ...repos[ri], panes }
      return { ...prev, repos }
    })
  }

  const addPane = (ri: number) => {
    setSettings((prev) => {
      const repos = [...prev.repos]
      repos[ri] = { ...repos[ri], panes: [...repos[ri].panes, { id: '', path: '', devServers: [] }] }
      return { ...prev, repos }
    })
  }

  const removePane = (ri: number, pi: number) => {
    setDeleteTarget({ kind: 'pane', repoIndex: ri, paneIndex: pi })
  }

  const updateDevServer = (ri: number, pi: number, di: number, updates: Partial<DevServerConfig>) => {
    setSettings((prev) => {
      const repos = [...prev.repos]
      const panes = [...repos[ri].panes]
      const devServers = [...panes[pi].devServers]
      devServers[di] = { ...devServers[di], ...updates }
      panes[pi] = { ...panes[pi], devServers }
      repos[ri] = { ...repos[ri], panes }
      return { ...prev, repos }
    })
  }

  const addDevServer = (ri: number, pi: number) => {
    setSettings((prev) => {
      const repos = [...prev.repos]
      const panes = [...repos[ri].panes]
      panes[pi] = { ...panes[pi], devServers: [...panes[pi].devServers, { label: '', command: '', args: [] }] }
      repos[ri] = { ...repos[ri], panes }
      return { ...prev, repos }
    })
  }

  const removeDevServer = (ri: number, pi: number, di: number) => {
    setDeleteTarget({ kind: 'devserver', repoIndex: ri, paneIndex: pi, dsIndex: di })
  }

  const confirmDelete = () => {
    if (!deleteTarget) return
    if (deleteTarget.kind === 'repo') {
      setSettings((prev) => ({
        ...prev,
        repos: prev.repos.filter((_, i) => i !== deleteTarget.repoIndex)
      }))
    } else if (deleteTarget.kind === 'pane') {
      setSettings((prev) => {
        const repos = [...prev.repos]
        repos[deleteTarget.repoIndex] = {
          ...repos[deleteTarget.repoIndex],
          panes: repos[deleteTarget.repoIndex].panes.filter((_, i) => i !== deleteTarget.paneIndex)
        }
        return { ...prev, repos }
      })
    } else {
      setSettings((prev) => {
        const repos = [...prev.repos]
        const panes = [...repos[deleteTarget.repoIndex].panes]
        panes[deleteTarget.paneIndex] = {
          ...panes[deleteTarget.paneIndex],
          devServers: panes[deleteTarget.paneIndex].devServers.filter((_, i) => i !== deleteTarget.dsIndex)
        }
        repos[deleteTarget.repoIndex] = { ...repos[deleteTarget.repoIndex], panes }
        return { ...prev, repos }
      })
    }
    setDeleteTarget(null)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await window.api.settings.set(settings)
      setToast({ message: '設定を保存しました', type: 'success' })
      window.api.ticket.providers().then(setProviders).catch(() => {})
    } catch {
      setToast({ message: '保存に失敗しました', type: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handlePluginToggle = useCallback(async (id: string, currentlyEnabled: boolean) => {
    setPluginLoading(id)
    try {
      if (currentlyEnabled) {
        await window.api.ticket.uninstall(id)
      } else {
        await window.api.ticket.install(id)
      }
      const [newSettings, newProviders] = await Promise.all([
        window.api.settings.get(),
        window.api.ticket.providers().catch(() => [] as TicketProviderMeta[])
      ])
      setSettings(newSettings)
      setProviders(newProviders)
    } catch (e) {
      setToast({ message: `プラグイン操作に失敗しました: ${(e as Error).message}`, type: 'error' })
    } finally {
      setPluginLoading(null)
    }
  }, [])

  const handleHookInstall = useCallback(async () => {
    setHookLoading(true)
    try {
      const result = await window.api.hooks.install()
      if (result.success) {
        setToast({ message: 'Stop Hook をインストールしました', type: 'success' })
        const status = await window.api.hooks.status()
        setHookStatus(status)
      } else {
        setToast({ message: result.error ?? 'インストールに失敗しました', type: 'error' })
      }
    } catch (e) {
      setToast({ message: `エラー: ${(e as Error).message}`, type: 'error' })
    } finally {
      setHookLoading(false)
    }
  }, [])

  const handleHookUninstall = useCallback(async () => {
    setHookLoading(true)
    try {
      const result = await window.api.hooks.uninstall()
      if (result.success) {
        setToast({ message: 'Stop Hook をアンインストールしました', type: 'success' })
        const status = await window.api.hooks.status()
        setHookStatus(status)
      } else {
        setToast({ message: result.error ?? 'アンインストールに失敗しました', type: 'error' })
      }
    } catch (e) {
      setToast({ message: `エラー: ${(e as Error).message}`, type: 'error' })
    } finally {
      setHookLoading(false)
    }
  }, [])

  const handleSyncPRs = useCallback(async () => {
    setPrSyncing(true)
    setPrSyncResult(null)
    try {
      const result = await window.api.github.syncPRs()
      setPrSyncResult(result)
    } finally {
      setPrSyncing(false)
    }
  }, [])

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
        {/* Repository / Pane Settings */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-3">リポジトリ / Pane マッピング</h2>

          {settings.repos.map((repo, ri) => (
            <div key={ri} className="bg-gray-800 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="text"
                  value={repo.id}
                  onChange={(e) => updateRepo(ri, { id: e.target.value })}
                  placeholder="Repo ID (例: repo1)"
                  className={`${inputClass} w-32`}
                />
                <input
                  type="text"
                  value={repo.name}
                  onChange={(e) => updateRepo(ri, { name: e.target.value })}
                  placeholder="表示名 (例: mep-frontend)"
                  className={`${inputClass} flex-1`}
                />
                <button
                  onClick={() => removeRepo(ri)}
                  className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                >
                  削除
                </button>
              </div>

              <div className="pl-4 border-l-2 border-gray-600 space-y-3">
                <span className="text-xs text-gray-400">Panes</span>
                {repo.panes.map((pane, pi) => (
                  <div key={pi} className="bg-gray-750 border border-gray-700 rounded p-3">
                    <div className="flex items-center gap-3 mb-2">
                      <input
                        type="text"
                        value={pane.id}
                        onChange={(e) => updatePane(ri, pi, { id: e.target.value })}
                        placeholder="Pane ID (例: p1)"
                        className={`${inputClass} w-28`}
                      />
                      <input
                        type="text"
                        value={pane.path}
                        onChange={(e) => updatePane(ri, pi, { path: e.target.value })}
                        placeholder="絶対パス"
                        className={`${inputClass} flex-1`}
                      />
                      <button
                        onClick={async () => {
                          const dir = await window.api.dialog.openDirectory()
                          if (dir) updatePane(ri, pi, { path: dir })
                        }}
                        className="px-2 py-1 rounded text-xs bg-gray-600 hover:bg-gray-500 text-gray-200 whitespace-nowrap"
                      >
                        選択
                      </button>
                      <button
                        onClick={() => removePane(ri, pi)}
                        className="px-2 py-1 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                      >
                        削除
                      </button>
                    </div>

                    <div className="pl-3 border-l-2 border-gray-700">
                      <span className="text-xs text-gray-500 block mb-1.5">Dev Servers</span>
                      {pane.devServers.map((ds, di) => (
                        <div key={di} className="flex items-center gap-2 mb-2">
                          <input
                            type="text"
                            value={ds.label}
                            onChange={(e) => updateDevServer(ri, pi, di, { label: e.target.value })}
                            placeholder="Label"
                            className={`${inputClass} flex-[3] min-w-0`}
                          />
                          <input
                            type="text"
                            value={ds.command}
                            onChange={(e) => updateDevServer(ri, pi, di, { command: e.target.value })}
                            placeholder="Command"
                            className={`${inputClass} flex-[2] min-w-0`}
                          />
                          <ArgsInput
                            value={ds.args}
                            onChange={(args) => updateDevServer(ri, pi, di, { args })}
                            placeholder="Args (space sep)"
                            className={`${inputClass} flex-[3] min-w-0`}
                          />
                          <input
                            type="number"
                            value={ds.port ?? ''}
                            onChange={(e) =>
                              updateDevServer(ri, pi, di, { port: e.target.value ? Number(e.target.value) : undefined })
                            }
                            placeholder="Port"
                            className={`${inputClass} flex-[2] min-w-0`}
                          />
                          <button
                            onClick={() => removeDevServer(ri, pi, di)}
                            className="px-2 py-0.5 rounded text-xs bg-red-600 hover:bg-red-700 text-white"
                          >
                            x
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => addDevServer(ri, pi)}
                        className="mt-1 px-2 py-0.5 rounded text-xs bg-gray-600 hover:bg-gray-500 text-gray-300"
                      >
                        + Dev Server追加
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  onClick={() => addPane(ri)}
                  className="px-2 py-1 rounded text-xs bg-gray-600 hover:bg-gray-500 text-gray-300"
                >
                  + Pane追加
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={addRepo}
            className="px-3 py-1 rounded text-xs bg-blue-600 hover:bg-blue-700 text-white"
          >
            + リポジトリ追加
          </button>
        </section>

        {/* Claude Code Stop Hook */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">Claude Code Stop Hook</h2>
          <p className="text-xs text-gray-500 mb-3">
            Stop Hook をインストールすると、Claude Code がタスクを完了した際にステータスを自動で更新します。
          </p>
          <div className="bg-gray-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">ポート番号</span>
              <input
                type="number"
                min={1024}
                max={65535}
                value={settings.stopHookPort ?? 39457}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, stopHookPort: Number(e.target.value) || 39457 }))
                }
                className={`${inputClass} w-28`}
              />
              <span className="text-xs text-gray-500">変更後は再起動が必要です</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">インストール先</span>
              <span className="text-xs text-gray-300 font-mono">
                {hookStatus?.path ?? '~/.claude/hooks/stop.sh'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-16">状態</span>
              {hookStatus === null ? (
                <span className="text-xs text-gray-500">確認中...</span>
              ) : hookStatus.installed && hookStatus.managedByApp && hookStatus.registeredInSettings ? (
                <span className="text-xs text-green-400">✅ インストール済み・settings.json 登録済み</span>
              ) : hookStatus.installed && hookStatus.managedByApp && !hookStatus.registeredInSettings ? (
                <span className="text-xs text-yellow-400">⚠️ stop.sh はあるが settings.json 未登録（再インストールしてください）</span>
              ) : hookStatus.installed ? (
                <span className="text-xs text-yellow-400">⚠️ 別の stop.sh が存在します（このアプリが管理していません）</span>
              ) : (
                <span className="text-xs text-gray-400">⬜ 未インストール</span>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleHookInstall}
                disabled={hookLoading || (hookStatus?.installed && hookStatus?.managedByApp && hookStatus?.registeredInSettings)}
                className="px-4 py-1.5 rounded text-sm bg-green-700 hover:bg-green-600 text-white disabled:opacity-40"
              >
                {hookLoading ? '処理中...' : 'インストール'}
              </button>
              <button
                onClick={handleHookUninstall}
                disabled={hookLoading || !hookStatus?.installed || !hookStatus?.managedByApp}
                className="px-4 py-1.5 rounded text-sm bg-red-700 hover:bg-red-600 text-white disabled:opacity-40"
              >
                アンインストール
              </button>
            </div>
          </div>
        </section>

        {/* 通知設定 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">通知</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.notificationsEnabled ?? true}
              onChange={(e) => setSettings((prev) => ({ ...prev, notificationsEnabled: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm text-gray-300">デスクトップ通知を有効にする</span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-7">タスク完了・コンテキスト警告・PR同期の通知を表示します</p>
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
                bugfix: ['{branch}', '{ticket}'],
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

        {/* プラグイン管理 */}
        {catalog.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-300 mb-3">プラグイン管理</h2>
            <div className="space-y-2">
              {catalog.map((entry) => {
                const isEnabled = (settings.enabledPlugins ?? []).includes(entry.id)
                const loading = pluginLoading === entry.id
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between bg-gray-800 rounded px-4 py-3"
                  >
                    <div>
                      <span className="text-sm text-white font-medium">{entry.displayName}</span>
                      <span className="text-xs text-gray-400 ml-3">{entry.description}</span>
                    </div>
                    <button
                      onClick={() => handlePluginToggle(entry.id, isEnabled)}
                      disabled={loading}
                      className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap disabled:opacity-40 ${
                        isEnabled
                          ? 'bg-red-700 hover:bg-red-600 text-white'
                          : 'bg-green-700 hover:bg-green-600 text-white'
                      }`}
                    >
                      {loading ? '処理中...' : isEnabled ? 'アンインストール' : 'インストール'}
                    </button>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* チケット連携プラグイン設定（動的レンダリング） */}
        {providers.map((provider) => (
          <section key={provider.id}>
            <h2 className="text-sm font-semibold text-gray-300 mb-3">{provider.displayName} 連携</h2>
            <div className="space-y-3">
              {provider.settingFields.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs text-gray-400 mb-1">{field.label}</label>
                  <input
                    type={field.type === 'password' ? 'password' : 'text'}
                    value={settings.pluginSettings?.[provider.id]?.[field.key] ?? ''}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        pluginSettings: {
                          ...prev.pluginSettings,
                          [provider.id]: {
                            ...(prev.pluginSettings?.[provider.id] ?? {}),
                            [field.key]: e.target.value,
                          },
                        },
                      }))
                    }
                    placeholder={field.placeholder}
                    className={`${inputClass} w-full max-w-md`}
                  />
                  {field.description && (
                    <p className="text-xs text-gray-500 mt-1">{field.description}</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}

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
          <p className="text-xs text-gray-500 mt-1">PR ステータス取得・レビュー依頼PR同期に使用（暗号化して保存）</p>
        </section>

        {/* GitHub PR 自動同期 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-300 mb-2">GitHub PR レビュー自動同期</h2>
          <p className="text-xs text-gray-500 mb-3">
            レビュー依頼されているPRを定期取得し、未起票のものを自動でタスク作成します。
          </p>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 whitespace-nowrap w-32">GitHub ユーザー名 *</label>
              <input
                type="text"
                value={settings.githubUsername ?? ''}
                onChange={(e) => setSettings((prev) => ({ ...prev, githubUsername: e.target.value }))}
                placeholder="your-github-username"
                className={`${inputClass} w-64`}
              />
            </div>
            <div className="flex items-center gap-3">
              <label className="text-xs text-gray-400 whitespace-nowrap w-32">同期間隔（分）</label>
              <input
                type="number"
                min={1}
                value={settings.githubPrSyncIntervalMin ?? 5}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, githubPrSyncIntervalMin: Number(e.target.value) || 5 }))
                }
                className={`${inputClass} w-24`}
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSyncPRs}
                disabled={prSyncing || !settings.githubUsername || !settings.githubPat}
                className="px-4 py-1.5 rounded text-sm bg-green-700 hover:bg-green-600 text-white disabled:opacity-40"
              >
                {prSyncing ? '同期中...' : '今すぐ同期'}
              </button>
              {prSyncResult && (
                <span className="text-xs text-gray-400">
                  {prSyncResult.total} 件中 {prSyncResult.created} 件を新規作成
                </span>
              )}
            </div>
          </div>
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

        {/* Save / Import / Export */}
        <div className="pt-4 flex items-center gap-3 flex-wrap">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
          <button
            onClick={async () => { await window.api.settings.export() }}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
          >
            エクスポート
          </button>
          <button
            onClick={async () => {
              setImportResult(null)
              try {
                const imported = await window.api.settings.import()
                if (imported) {
                  setSettings(imported)
                  setImportResult('ok')
                  setToast({ message: 'インポート完了！設定を反映しました', type: 'success' })
                } else {
                  setImportResult('cancelled')
                }
              } catch {
                setImportResult('error')
                setToast({ message: 'インポートに失敗しました', type: 'error' })
              }
            }}
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-500 text-white text-sm"
          >
            インポート
          </button>
        </div>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="削除の確認"
        message={
          deleteTarget?.kind === 'repo'
            ? `リポジトリ「${settings.repos[deleteTarget.repoIndex]?.name || ''}」を削除しますか？`
            : deleteTarget?.kind === 'pane'
            ? `Pane「${settings.repos[deleteTarget.repoIndex]?.panes[deleteTarget.paneIndex]?.id || ''}」を削除しますか？`
            : `Dev Server「${settings.repos[deleteTarget?.repoIndex ?? 0]?.panes[deleteTarget?.paneIndex ?? 0]?.devServers[deleteTarget?.dsIndex ?? 0]?.label || ''}」を削除しますか？`
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
