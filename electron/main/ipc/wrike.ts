import { ipcMain } from 'electron'
import type { WrikeService } from '../services/WrikeService'
import type { AppSettings } from '../../../src/types/ipc'

export function registerWrikeHandlers(
  wrikeService: WrikeService,
  getSettings: () => Pick<AppSettings, 'wrikeAccessToken' | 'wrikeItemTypeFeatId' | 'wrikeItemTypeBugfixId'>
): void {
  ipcMain.handle('wrike:fetch-ticket', async (_, url: string) => {
    const { wrikeAccessToken, wrikeItemTypeFeatId, wrikeItemTypeBugfixId } = getSettings()
    if (!wrikeAccessToken) {
      throw new Error('Wrikeアクセストークンが設定されていません')
    }
    return wrikeService.fetchTicket(url, wrikeAccessToken, {
      featId: wrikeItemTypeFeatId,
      bugfixId: wrikeItemTypeBugfixId,
    })
  })
}
