export type PluginSettingField = {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  placeholder?: string
  description?: string
  encrypted?: boolean
}

export type TicketProviderMeta = {
  id: string
  displayName: string
  urlPattern: string
  settingFields: PluginSettingField[]
  configured: boolean
}

export type TicketFetchResult = {
  providerId: string
  id: string
  title: string
  taskType: 'feat' | 'bugfix' | null
  url: string
  meta?: Record<string, string>
}
