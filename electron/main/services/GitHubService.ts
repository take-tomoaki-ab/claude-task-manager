export type GitHubPullRequest = {
  number: number
  title: string
  html_url: string
  repositoryName: string
  repositoryFullName: string
  draft: boolean
  state: string
}

export class GitHubService {
  async fetchReviewRequestedPRs(username: string, pat: string): Promise<GitHubPullRequest[]> {
    const query = `is:pr is:open review-requested:${username} archived:false`
    const headers = {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }

    type RawItem = {
      number: number
      title: string
      html_url: string
      repository_url: string
      draft: boolean
      state: string
    }

    const allItems: RawItem[] = []
    const perPage = 100
    let page = 1

    while (true) {
      const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`
      const res = await fetch(url, { headers })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`GitHub API error ${res.status}: ${body}`)
      }

      const data = (await res.json()) as { total_count?: number; items?: RawItem[] }

      if (!data.items) {
        throw new Error(`GitHub API returned unexpected response (items missing)`)
      }

      allItems.push(...data.items)

      // 取得件数が total_count に達したか、1ページ未満なら終了
      if (data.items.length < perPage || allItems.length >= (data.total_count ?? 0)) {
        break
      }
      page++
    }

    return allItems.map((item) => {
      // repository_url: https://api.github.com/repos/owner/repo
      const parts = item.repository_url.split('/')
      const repositoryFullName = `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
      const repositoryName = parts[parts.length - 1]
      return {
        number: item.number,
        title: item.title,
        html_url: item.html_url,
        repositoryName,
        repositoryFullName,
        draft: item.draft ?? false,
        state: item.state
      }
    })
  }

  /**
   * Notifications API 経由でレビュー依頼PRを補完取得する。
   * Search API が拾い損ねたPRをカバーするためのサプリメント。
   * knownUrls に含まれる URL は検証をスキップする。
   */
  async fetchPRsFromNotifications(
    username: string,
    pat: string,
    knownUrls: Set<string>
  ): Promise<GitHubPullRequest[]> {
    const headers = {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }

    // 直近90日の通知を取得（それ以上古いレビュー依頼は対象外）
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const res = await fetch(
      `https://api.github.com/notifications?all=true&since=${since}&per_page=100`,
      { headers }
    )
    if (!res.ok) return []

    type NotifItem = { reason: string; subject: { type: string; url: string } }
    const items = await res.json() as NotifItem[]

    // review_requested な PullRequest 通知のみ、かつ Search 結果にない URL だけ
    const candidateUrls = items
      .filter(n => n.reason === 'review_requested' && n.subject?.type === 'PullRequest')
      .map(n =>
        n.subject.url
          .replace('https://api.github.com/repos/', 'https://github.com/')
          .replace('/pulls/', '/pull/')
      )
      .filter(url => !knownUrls.has(url))

    // 重複排除
    const uniqueUrls = [...new Set(candidateUrls)]

    const result: GitHubPullRequest[] = []
    for (const htmlUrl of uniqueUrls) {
      try {
        const pr = await this.verifyPendingReview(htmlUrl, username, headers)
        if (pr) result.push(pr)
      } catch {
        // 個別PRの検証失敗は無視
      }
    }
    return result
  }

  private async verifyPendingReview(
    htmlUrl: string,
    username: string,
    headers: Record<string, string>
  ): Promise<GitHubPullRequest | null> {
    const match = htmlUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!match) return null
    const [, owner, repo, number] = match
    const base = `https://api.github.com/repos/${owner}/${repo}`

    // PRがまだopenか確認
    const prRes = await fetch(`${base}/pulls/${number}`, { headers })
    if (!prRes.ok) return null
    const pr = await prRes.json()
    if (pr.state !== 'open') return null

    // 自分がまだ requested_reviewers に含まれているか確認
    const reviewersRes = await fetch(`${base}/pulls/${number}/requested_reviewers`, { headers })
    if (!reviewersRes.ok) return null
    const { users } = await reviewersRes.json() as { users: Array<{ login: string }> }
    const isRequested = users?.some(u => u.login.toLowerCase() === username.toLowerCase())
    if (!isRequested) return null

    return {
      number: pr.number,
      title: pr.title,
      html_url: pr.html_url,
      repositoryName: repo,
      repositoryFullName: `${owner}/${repo}`,
      draft: pr.draft ?? false,
      state: pr.state
    }
  }

  async fetchPRStatus(
    url: string,
    pat: string
  ): Promise<'open' | 'draft' | 'merged' | 'closed' | null> {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/)
    if (!match) return null
    const [, owner, repo, number] = match

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`
    const res = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    if (!res.ok) return null

    const data = await res.json()
    if (data.merged) return 'merged'
    if (data.draft) return 'draft'
    return data.state as 'open' | 'closed'
  }
}
