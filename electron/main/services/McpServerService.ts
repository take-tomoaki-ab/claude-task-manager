import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { ListToolsRequestSchema, CallToolRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import type { LocalHttpServer } from './LocalHttpServer.js'
import type { TaskService } from './TaskService.js'
import type { Task } from '../../../src/types/task.js'
import type { AppSettings } from '../../../src/types/ipc.js'

export class McpServerService {
  constructor(
    localServer: LocalHttpServer,
    taskService: TaskService,
    getSettings: () => AppSettings,
    notifyTasksUpdated: () => void = () => {}
  ) {
    const createServer = (): Server => {
      const server = new Server(
        { name: 'toride', version: '1.0.0' },
        { capabilities: { tools: {} } }
      )

      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
          {
            name: 'create_task',
            description: 'ToRide にタスクを登録する',
            inputSchema: {
              type: 'object' as const,
              properties: {
                type: {
                  type: 'string',
                  enum: ['feat', 'bugfix', 'review', 'research', 'design', 'chore'],
                  description: 'タスクのタイプ',
                },
                title: { type: 'string', description: 'タスクのタイトル' },
                branch: { type: 'string', description: 'ブランチ名（type が feat/bugfix/research の場合は必須）' },
                baseBranch: { type: 'string', description: '分岐元ブランチ名' },
                ticket: { type: 'string', description: 'WrikeチケットURL' },
                prompt: { type: 'string', description: 'Claude に渡すプロンプト' },
                repoId: { type: 'string', description: 'リポジトリID（chore以外のタイプでは必須。list_repos で確認可能）' },
                url: { type: 'string', description: 'GitHub PR URL（type が review の場合は必須）' },
                output: { type: 'string', description: '出力先パス（type が design の場合は必須）' },
                directory: { type: 'string', description: '作業ディレクトリ（type が chore の場合は必須）' },
              },
              required: ['type', 'title'],
            },
          },
          {
            name: 'list_tasks',
            description: '現在登録されているタスクの一覧を取得する',
            inputSchema: {
              type: 'object' as const,
              properties: {
                status: {
                  type: 'string',
                  enum: ['will_do', 'doing', 'done'],
                  description: 'フィルタするステータス（省略時は全件）',
                },
              },
            },
          },
          {
            name: 'list_repos',
            description: '設定済みのリポジトリ一覧を取得する。create_task の repoId に使う値がわかる',
            inputSchema: { type: 'object' as const, properties: {} },
          },
          {
            name: 'update_task',
            description: 'タスクのステータスやプロンプトを更新する',
            inputSchema: {
              type: 'object' as const,
              properties: {
                id: { type: 'string', description: 'タスクID' },
                status: {
                  type: 'string',
                  enum: ['will_do', 'doing', 'done'],
                  description: '新しいステータス',
                },
                prompt: { type: 'string', description: '新しいプロンプト' },
              },
              required: ['id'],
            },
          },
          {
            name: 'delete_task',
            description: 'タスクを削除する',
            inputSchema: {
              type: 'object' as const,
              properties: {
                id: { type: 'string', description: 'タスクID' },
              },
              required: ['id'],
            },
          },
        ],
      }))

      server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const args = (req.params.arguments ?? {}) as Record<string, unknown>
        try {
          switch (req.params.name) {
            case 'list_repos': {
              const repos = getSettings().repos.map((r) => ({ id: r.id, name: r.name }))
              return { content: [{ type: 'text' as const, text: JSON.stringify(repos, null, 2) }] }
            }
            case 'create_task': {
              const { type, title, status, pane, ...rest } = args as {
                type: Task['type']
                title: string
                status?: Task['status']
                pane?: string
                [key: string]: unknown
              }
              if (type !== 'chore' && !rest.repoId) {
                throw new Error('repoId is required for non-chore tasks. Use list_repos to get valid repo IDs.')
              }
              const task = taskService.create({
                type,
                title,
                status: status ?? 'will_do',
                pane: pane ?? '',
                ...rest,
              } as Omit<Task, 'id' | 'created_at'>)
              notifyTasksUpdated()
              return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] }
            }
            case 'list_tasks': {
              const tasks = taskService.list()
              const filtered = args.status
                ? tasks.filter((t) => t.status === args.status)
                : tasks
              return { content: [{ type: 'text' as const, text: JSON.stringify(filtered, null, 2) }] }
            }
            case 'update_task': {
              const { id, ...data } = args as { id: string } & Record<string, unknown>
              const task = taskService.update(id, data as Partial<Task>)
              notifyTasksUpdated()
              return { content: [{ type: 'text' as const, text: JSON.stringify(task, null, 2) }] }
            }
            case 'delete_task': {
              const { id } = args as { id: string }
              taskService.delete(id)
              notifyTasksUpdated()
              return { content: [{ type: 'text' as const, text: `deleted: ${id}` }] }
            }
            default:
              throw new Error(`Unknown tool: ${req.params.name}`)
          }
        } catch (e) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${(e as Error).message}` }],
            isError: true,
          }
        }
      })

      return server
    }

    // StreamableHTTP エンドポイント (GET/POST /mcp)
    localServer.addRawRoute('/mcp', async (req, res) => {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      const server = createServer()
      await server.connect(transport)
      await transport.handleRequest(req, res)
    })
  }
}
