import type { TicketPlugin, TicketInfo } from './index'
import type { PluginSettingField } from '../../../../src/types/plugin'

type WrikeTaskRaw = {
  id: string
  title: string
}

export class WrikeTicketPlugin implements TicketPlugin {
  readonly id = 'wrike'
  readonly displayName = 'Wrike'
  readonly urlPattern = /wrike\.com/
  readonly settingFields: PluginSettingField[] = [
    {
      key: 'accessToken',
      label: 'アクセストークン',
      type: 'password',
      placeholder: 'Wrike personal access token',
      description: 'Wrike設定 > API > Personal access tokens から発行（暗号化保存）',
      encrypted: true,
    },
  ]

  canHandle(url: string): boolean {
    return this.urlPattern.test(url)
  }

  async fetchTicket(url: string, settings: Record<string, string>): Promise<TicketInfo> {
    const { accessToken } = settings
    if (!accessToken) throw new Error('Wrikeアクセストークンが設定されていません')

    const rawId = this.extractTaskId(url)
    if (!rawId) throw new Error('WrikeのURLからタスクIDを取得できませんでした')

    let res: Response
    if (/^\d+$/.test(rawId)) {
      const params = new URLSearchParams({ permalink: url })
      res = await this.fetchWithAuth(`https://www.wrike.com/api/v4/tasks?${params}`, accessToken)
    } else {
      res = await this.fetchWithAuth(`https://www.wrike.com/api/v4/tasks/${rawId}`, accessToken)
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wrike API エラー ${res.status}: ${body}`)
    }

    const data = (await res.json()) as { data: WrikeTaskRaw[] }
    if (!data.data || data.data.length === 0) throw new Error('タスクが見つかりませんでした')

    const task = data.data[0]
    return {
      id: task.id,
      title: task.title,
      taskType: null,
      url,
    }
  }

  private async fetchWithAuth(url: string, token: string): Promise<Response> {
    return fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  }

  private extractTaskId(url: string): string | null {
    try {
      const id = new URL(url).searchParams.get('id')
      if (id) return id
    } catch {
      // invalid URL
    }
    return null
  }

}
