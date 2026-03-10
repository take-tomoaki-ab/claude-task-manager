export type WrikeTicketInfo = {
  id: string
  title: string
  taskType: 'feat' | 'bugfix' | null
  url: string
}

export class WrikeService {
  private async fetchWithAuth(url: string, token: string): Promise<Response> {
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  private extractTaskId(url: string): string | null {
    try {
      const parsed = new URL(url)
      // https://www.wrike.com/open.htm?id=IEXXXXXXYA (エンコードID) or numeric web ID
      const id = parsed.searchParams.get('id')
      if (id) return id
    } catch {
      // invalid URL
    }
    return null
  }

  // Wrike API は numeric web ID を直接受け付けないため、permalink パラメータで解決する
  private async resolveTaskId(
    rawId: string,
    permalinkUrl: string,
    token: string
  ): Promise<string> {
    // numeric ID かどうか確認（エンコードIDは英数字混在で数字のみではない）
    if (/^\d+$/.test(rawId)) {
      // permalink URL でタスクを検索する
      const params = new URLSearchParams({
        fields: '["customItemTypeId"]',
        permalink: permalinkUrl
      })
      const res = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/tasks?${params}`,
        token
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Wrike API エラー ${res.status}: ${body}`)
      }
      const data = (await res.json()) as {
        data: Array<{ id: string; title: string; customItemTypeId?: string }>
      }
      if (!data.data || data.data.length === 0) {
        throw new Error('タスクが見つかりませんでした（permalink検索）')
      }
      return data.data[0].id
    }
    // エンコードID はそのまま使用
    return rawId
  }

  async fetchTicket(url: string, token: string): Promise<WrikeTicketInfo> {
    const rawId = this.extractTaskId(url)
    if (!rawId) throw new Error('WrikeのURLからタスクIDを取得できませんでした')

    // numeric web ID の場合は permalink 検索でエンコード ID に変換
    let taskId = rawId
    let taskTitle = ''
    let customItemTypeId: string | undefined

    if (/^\d+$/.test(rawId)) {
      const params = new URLSearchParams({
        fields: '["customItemTypeId"]',
        permalink: url
      })
      const res = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/tasks?${params}`,
        token
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Wrike API エラー ${res.status}: ${body}`)
      }
      const data = (await res.json()) as {
        data: Array<{ id: string; title: string; customItemTypeId?: string }>
      }
      if (!data.data || data.data.length === 0) {
        throw new Error('タスクが見つかりませんでした')
      }
      taskId = data.data[0].id
      taskTitle = data.data[0].title
      customItemTypeId = data.data[0].customItemTypeId
    } else {
      // エンコードID の場合は直接取得
      const params = new URLSearchParams({ fields: '["customItemTypeId"]' })
      const res = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/tasks/${taskId}?${params}`,
        token
      )
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`Wrike API エラー ${res.status}: ${body}`)
      }
      const data = (await res.json()) as {
        data: Array<{ id: string; title: string; customItemTypeId?: string }>
      }
      if (!data.data || data.data.length === 0) {
        throw new Error('タスクが見つかりませんでした')
      }
      taskId = data.data[0].id
      taskTitle = data.data[0].title
      customItemTypeId = data.data[0].customItemTypeId
    }

    let taskType: 'feat' | 'bugfix' | null = null

    if (customItemTypeId) {
      // path パラメータではなく全件取得してフィルタ（Wrike API の正しい使い方）
      const citRes = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/customitemtypes`,
        token
      )
      if (!citRes.ok) {
        const body = await citRes.text()
        throw new Error(`カスタム項目タイプ取得エラー ${citRes.status}: ${body}`)
      }
      const citData = (await citRes.json()) as {
        data: Array<{ id: string; name: string }>
      }
      const matched = citData.data.find((t) => t.id === customItemTypeId)
      if (matched) {
        if (matched.name === '実装チケット') taskType = 'feat'
        else if (matched.name === 'QA指摘') taskType = 'bugfix'
      }
    }

    return { id: taskId, title: taskTitle, taskType, url }
  }
}
