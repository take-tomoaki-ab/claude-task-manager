import type { PluginCatalogEntry } from '../../../src/types/plugin'
import type { TicketPlugin } from './ticket/index'
import { WrikeTicketPlugin } from './ticket/WrikeTicketPlugin'
import { GitHubIssueTicketPlugin } from './ticket/GitHubIssueTicketPlugin'

export type CatalogItem = PluginCatalogEntry & { factory: () => TicketPlugin }

export const PLUGIN_CATALOG: CatalogItem[] = [
  {
    id: 'wrike',
    displayName: 'Wrike',
    description: 'Wrikeチケット連携',
    category: 'ticket',
    factory: () => new WrikeTicketPlugin(),
  },
  {
    id: 'github-issue',
    displayName: 'GitHub Issue',
    description: 'GitHub Issueチケット連携',
    category: 'ticket',
    factory: () => new GitHubIssueTicketPlugin(),
  },
]
