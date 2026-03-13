import type { TicketPlugin } from './ticket/index'

export class PluginRegistry {
  private ticketPlugins = new Map<string, TicketPlugin>()

  registerTicketPlugin(plugin: TicketPlugin): void {
    this.ticketPlugins.set(plugin.id, plugin)
  }

  findTicketPlugin(url: string): TicketPlugin | undefined {
    for (const plugin of this.ticketPlugins.values()) {
      if (plugin.canHandle(url)) return plugin
    }
    return undefined
  }

  listTicketPlugins(): TicketPlugin[] {
    return Array.from(this.ticketPlugins.values())
  }
}
