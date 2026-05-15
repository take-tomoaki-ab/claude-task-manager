import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

// ~/.claude/settings.json ではなく ~/.claude.json が Claude Code の MCP 設定ファイル
const CLAUDE_JSON_FILE = path.join(homedir(), '.claude.json')
const MCP_SERVER_NAME = 'claude-task-manager'

type ClaudeJson = {
  mcpServers?: Record<string, { type: string; url: string }>
  [key: string]: unknown
}

export class McpHookService {
  private readClaudeJson(): ClaudeJson {
    try {
      const content = fs.readFileSync(CLAUDE_JSON_FILE, 'utf-8')
      return JSON.parse(content) as ClaudeJson
    } catch {
      return {}
    }
  }

  private writeClaudeJson(data: ClaudeJson): void {
    fs.mkdirSync(path.dirname(CLAUDE_JSON_FILE), { recursive: true })
    fs.writeFileSync(CLAUDE_JSON_FILE, JSON.stringify(data, null, 2), 'utf-8')
  }

  install(port: number): { success: boolean; error?: string } {
    try {
      const url = `http://127.0.0.1:${port}/mcp`
      const data = this.readClaudeJson()
      if (!data.mcpServers) data.mcpServers = {}
      data.mcpServers[MCP_SERVER_NAME] = { type: 'http', url }
      this.writeClaudeJson(data)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  uninstall(): { success: boolean; error?: string } {
    try {
      const data = this.readClaudeJson()
      if (data.mcpServers) {
        delete data.mcpServers[MCP_SERVER_NAME]
        if (Object.keys(data.mcpServers).length === 0) delete data.mcpServers
      }
      this.writeClaudeJson(data)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  getStatus(): { installed: boolean; url: string } {
    const data = this.readClaudeJson()
    const entry = data.mcpServers?.[MCP_SERVER_NAME]
    return {
      installed: !!entry,
      url: entry?.url ?? '',
    }
  }
}
