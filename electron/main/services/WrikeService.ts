export type WrikeTicketInfo = {
  id: string
  title: string
  taskType: 'feat' | 'bugfix' | null
  url: string
}

type WrikeTaskRaw = {
  id: string
  title: string
  customItemType?: { id: string; name: string }
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
      const id = parsed.searchParams.get('id')
      if (id) return id
    } catch {
      // invalid URL
    }
    return null
  }

  private resolveTaskType(customItemType?: { name: string }): 'feat' | 'bugfix' | null {
    if (!customItemType) return null
    if (customItemType.name === '実装チケット') return 'feat'
    if (customItemType.name === 'QA指摘') return 'bugfix'
    return null
  }

  async fetchTicket(url: string, token: string): Promise<WrikeTicketInfo> {
    const rawId = this.extractTaskId(url)
    if (!rawId) throw new Error('WrikeのURLからタスクIDを取得できませんでした')

    // customItemType フィールド（オブジェクト全体）を1回のリクエストで取得
    const fields = '["customItemType"]'
    let res: Response

    if (/^\d+$/.test(rawId)) {
      // numeric web ID → permalink パラメータで検索
      const params = new URLSearchParams({ fields, permalink: url })
      res = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/tasks?${params}`,
        token
      )
    } else {
      // エンコードID → 直接取得
      const params = new URLSearchParams({ fields })
      res = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/tasks/${rawId}?${params}`,
        token
      )
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Wrike API エラー ${res.status}: ${body}`)
    }

    const data = (await res.json()) as { data: WrikeTaskRaw[] }
    if (!data.data || data.data.length === 0) {
      throw new Error('タスクが見つかりませんでした')
    }

    const task = data.data[0]
    return {
      id: task.id,
      title: task.title,
      taskType: this.resolveTaskType(task.customItemType),
      url,
    }
  }
}
