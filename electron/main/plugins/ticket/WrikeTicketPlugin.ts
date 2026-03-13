import { WrikeService } from '../../services/WrikeService'
import type { TicketPlugin, TicketInfo } from './index'
import type { PluginSettingField } from '../../../../src/types/plugin'

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

  private service = new WrikeService()

  canHandle(url: string): boolean {
    return this.urlPattern.test(url)
  }

  async fetchTicket(url: string, settings: Record<string, string>): Promise<TicketInfo> {
    const { accessToken, itemTypeFeatId, itemTypeBugfixId } = settings
    if (!accessToken) throw new Error('Wrikeアクセストークンが設定されていません')

    const info = await this.service.fetchTicket(url, accessToken, {
      featId: itemTypeFeatId,
      bugfixId: itemTypeBugfixId,
    })

    return {
      id: info.id,
      title: info.title,
      taskType: info.taskType,
      url: info.url,
      ...(info.customItemTypeId ? { meta: { customItemTypeId: info.customItemTypeId } } : {}),
    }
  }
}
