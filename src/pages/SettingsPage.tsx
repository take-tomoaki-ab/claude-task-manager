import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AppSettings, PaneConfig, DevServerConfig } from '../types/ipc'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [settings, setSettings] = useState<AppSettings>({ panes: [] })
  const [saving, setSaving] = useState(false)

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
    setSettings((prev) => ({
      ...prev,
      panes: prev.panes.filter((_, i) => i !== index)
    }))
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
    setSettings((prev) => {
      const panes = [...prev.panes]
      panes[paneIndex] = {
        ...panes[paneIndex],
        devServers: panes[paneIndex].devServers.filter((_, i) => i !== dsIndex)
      }
      return { ...prev, panes }
    })
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
                    <input
                      type="text"
                      value={ds.args.join(' ')}
                      onChange={(e) =>
                        updateDevServer(pi, di, { args: e.target.value.split(' ').filter(Boolean) })
                      }
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
    </div>
  )
}
