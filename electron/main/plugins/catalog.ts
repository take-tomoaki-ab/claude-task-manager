import type { PluginCatalogEntry } from '../../../src/types/plugin'
import type { TicketPlugin } from './ticket/index'
import { WrikeTicketPlugin } from './ticket/WrikeTicketPlugin'

export type CatalogItem = PluginCatalogEntry & { factory: () => TicketPlugin }

export const PLUGIN_CATALOG: CatalogItem[] = [
  {
    id: 'wrike',
    displayName: 'Wrike',
    description: 'Wrikeチケット連携',
    category: 'ticket',
    factory: () => new WrikeTicketPlugin(),
  },
]
