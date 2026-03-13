import type { PluginCatalogEntry } from '../../../src/types/plugin'
import type { TicketPlugin } from './ticket/index'

export type CatalogItem = PluginCatalogEntry & { factory: () => TicketPlugin }

export const PLUGIN_CATALOG: CatalogItem[] = [
  {
    id: 'wrike',
    displayName: 'Wrike',
    description: 'Wrikeチケット連携',
    category: 'ticket',
    factory: () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { WrikeTicketPlugin } = require('./ticket/WrikeTicketPlugin')
      return new WrikeTicketPlugin()
    },
  },
]
