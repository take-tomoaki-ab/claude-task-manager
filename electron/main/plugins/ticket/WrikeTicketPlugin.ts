import type { TicketPlugin, TicketInfo } from './index'
import type { PluginSettingField } from '../../../../src/types/plugin'

type WrikeTaskRaw = {
  id: string
  title: string
  customItemTypeId?: string
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
    {
      key: 'itemTypeFeatId',
      label: 'カスタム項目タイプID（feat）',
      type: 'text',
      placeholder: '実装チケット の customItemTypeId',
    },
    {
      key: 'itemTypeBugfixId',
      label: 'カスタム項目タイプID（bugfix）',
      type: 'text',
      placeholder: 'QA指摘 の customItemTypeId',
    },
  ]

  canHandle(url: string): boolean {
    return this.urlPattern.test(url)
  }

  async fetchTicket(url: string, settings: Record<string, string>): Promise<TicketInfo> {
    const { accessToken, itemTypeFeatId, itemTypeBugfixId } = settings
    if (!accessToken) throw new Error('Wrikeアクセストークンが設定されていません')

    const rawId = this.extractTaskId(url)
    if (!rawId) throw new Error('WrikeのURLからタスクIDを取得できませんでした')

    const fields = '["customItemTypeId"]'
    let res: Response

    if (/^\d+$/.test(rawId)) {
      // numeric web ID → permalink パラメータで検索
      const params = new URLSearchParams({ fields, permalink: url })
      res = await this.fetchWithAuth(`https://www.wrike.com/api/v4/tasks?${params}`, accessToken)
    } else {
      // エンコードID → 直接取得
      const params = new URLSearchParams({ fields })
      res = await this.fetchWithAuth(`https://www.wrike.com/api/v4/tasks/${rawId}?${params}`, accessToken)
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
      taskType: this.resolveTaskType(task.customItemTypeId, itemTypeFeatId, itemTypeBugfixId),
      url,
      ...(task.customItemTypeId ? { meta: { customItemTypeId: task.customItemTypeId } } : {}),
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

  private resolveTaskType(
    customItemTypeId: string | undefined,
    featId?: string,
    bugfixId?: string
  ): 'feat' | 'bugfix' | null {
    if (!customItemTypeId) return null
    if (featId && customItemTypeId === featId) return 'feat'
    if (bugfixId && customItemTypeId === bugfixId) return 'bugfix'
    return null
  }
}
