import type { TicketPlugin, TicketInfo, PluginSettingField } from './index'

type GitHubIssueRaw = {
  number: number
  title: string
  html_url: string
  labels: Array<{ name: string }>
}

export class GitHubIssueTicketPlugin implements TicketPlugin {
  readonly id = 'github-issue'
  readonly displayName = 'GitHub Issue'
  readonly urlPattern = /github\.com\/[^/]+\/[^/]+\/issues\/\d+/
  readonly settingFields: PluginSettingField[] = []

  canHandle(url: string): boolean {
    return this.urlPattern.test(url)
  }

  async fetchTicket(url: string, settings: Record<string, string>): Promise<TicketInfo> {
    const parsed = this.parseUrl(url)
    if (!parsed) throw new Error('GitHub IssueのURLを解析できませんでした')

    const { owner, repo, number } = parsed
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`

    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (settings.githubPat) {
      headers['Authorization'] = `Bearer ${settings.githubPat}`
    }

    const res = await fetch(apiUrl, { headers })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitHub API エラー ${res.status}: ${body}`)
    }

    const issue = (await res.json()) as GitHubIssueRaw
    const isBug = issue.labels.some((l) => l.name.toLowerCase() === 'bug')

    return {
      id: String(issue.number),
      title: issue.title,
      taskType: isBug ? 'bugfix' : 'feat',
      url: issue.html_url,
    }
  }

  private parseUrl(url: string): { owner: string; repo: string; number: number } | null {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/)
    if (!match) return null
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) }
  }
}
