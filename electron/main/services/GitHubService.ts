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
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(query)}&per_page=50`

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${pat}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GitHub API error ${res.status}: ${body}`)
    }

    const data = (await res.json()) as {
      items: Array<{
        number: number
        title: string
        html_url: string
        repository_url: string
        draft: boolean
        state: string
      }>
    }

    return data.items.map((item) => {
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
}
