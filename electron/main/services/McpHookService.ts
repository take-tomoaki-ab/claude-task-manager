import fs from 'fs'
import path from 'path'
import { homedir } from 'os'

const CLAUDE_SETTINGS_FILE = path.join(homedir(), '.claude', 'settings.json')
const MCP_SERVER_NAME = 'claude-task-manager'

type ClaudeSettings = {
  mcpServers?: Record<string, { url: string }>
  [key: string]: unknown
}

export class McpHookService {
  private readClaudeSettings(): ClaudeSettings {
    try {
      const content = fs.readFileSync(CLAUDE_SETTINGS_FILE, 'utf-8')
      return JSON.parse(content) as ClaudeSettings
    } catch {
      return {}
    }
  }

  private writeClaudeSettings(settings: ClaudeSettings): void {
    fs.mkdirSync(path.dirname(CLAUDE_SETTINGS_FILE), { recursive: true })
    fs.writeFileSync(CLAUDE_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8')
  }

  install(port: number): { success: boolean; error?: string } {
    try {
      const url = `http://127.0.0.1:${port}/mcp`
      const settings = this.readClaudeSettings()
      if (!settings.mcpServers) settings.mcpServers = {}
      settings.mcpServers[MCP_SERVER_NAME] = { url }
      this.writeClaudeSettings(settings)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  uninstall(): { success: boolean; error?: string } {
    try {
      const settings = this.readClaudeSettings()
      if (settings.mcpServers) {
        delete settings.mcpServers[MCP_SERVER_NAME]
        if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers
      }
      this.writeClaudeSettings(settings)
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }

  getStatus(): { installed: boolean; url: string } {
    const settings = this.readClaudeSettings()
    const entry = settings.mcpServers?.[MCP_SERVER_NAME]
    return {
      installed: !!entry,
      url: entry?.url ?? '',
    }
  }
}
