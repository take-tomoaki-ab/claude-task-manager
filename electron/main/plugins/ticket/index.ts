import type { PluginSettingField } from '../../../../src/types/plugin'

export type { PluginSettingField }

export type TicketInfo = {
  id: string
  title: string
  taskType: 'feat' | 'bugfix' | null
  url: string
  meta?: Record<string, string>
}

export interface TicketPlugin {
  readonly id: string
  readonly displayName: string
  readonly urlPattern: RegExp
  readonly settingFields: PluginSettingField[]
  canHandle(url: string): boolean
  fetchTicket(url: string, settings: Record<string, string>): Promise<TicketInfo>
}
