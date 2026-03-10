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
      // https://www.wrike.com/open.htm?id=IEXXXXXXYA
      const id = parsed.searchParams.get('id')
      if (id) return id
    } catch {
      // invalid URL
    }
    return null
  }

  async fetchTicket(url: string, token: string): Promise<WrikeTicketInfo> {
    const taskId = this.extractTaskId(url)
    if (!taskId) throw new Error('WrikeのURLからタスクIDを取得できませんでした')

    // customItemTypeId を取得するために fields に指定
    const taskRes = await this.fetchWithAuth(
      `https://www.wrike.com/api/v4/tasks/${taskId}?fields=["customItemTypeId"]`,
      token
    )
    if (!taskRes.ok) {
      const body = await taskRes.text()
      throw new Error(`Wrike API エラー ${taskRes.status}: ${body}`)
    }

    const taskData = (await taskRes.json()) as {
      data: Array<{
        id: string
        title: string
        customItemTypeId?: string
      }>
    }

    if (!taskData.data || taskData.data.length === 0) {
      throw new Error('タスクが見つかりませんでした')
    }

    const task = taskData.data[0]
    let taskType: 'feat' | 'bugfix' | null = null

    if (task.customItemTypeId) {
      const citRes = await this.fetchWithAuth(
        `https://www.wrike.com/api/v4/customitemtypes/${task.customItemTypeId}`,
        token
      )
      if (citRes.ok) {
        const citData = (await citRes.json()) as {
          data: Array<{ id: string; name: string }>
        }
        const typeName = citData.data[0]?.name ?? ''
        if (typeName === '実装チケット') taskType = 'feat'
        else if (typeName === 'QA指摘') taskType = 'bugfix'
      }
    }

    return { id: task.id, title: task.title, taskType, url }
  }
}
