import type { ActionRegistry } from '@/actions'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

export interface CommandResult {
  success: boolean
  message?: string
}

export interface IRCCommand {
  name: string
  aliases: string[]
  description: string
  usage: string
  minArgs: number
  maxArgs?: number
  execute: (args: string[], context: ActionContext<AppStore>) => Promise<CommandResult>
}

export class CommandParser {
  private commands = new Map<string, IRCCommand>()
  private registry: ActionRegistry<AppStore>

  constructor(registry: ActionRegistry<AppStore>) {
    this.registry = registry
    this.registerCommands()
  }

  private registerCommands(): void {
    this.register({
      name: 'help',
      aliases: ['h', '?'],
      description: 'Show help information',
      usage: '/help',
      minArgs: 0,
      execute: async (_, ctx) => {
        const helpLines = [
          '══════════════════════════════════════════════════════════',
          '           ObbyTTY IRC Client - Help                     ',
          '══════════════════════════════════════════════════════════',
          '',
          'INPUT:',
          '  • Paste: Cmd+V (Mac) or Ctrl+Shift+V (Linux)',
          '  • Tab         Complete /commands',
          '  • Up/Down     Navigate command history',
          '',
          'EMACS KEYBINDINGS (built-in):',
          '  • Ctrl+A / Ctrl+E    Move to start/end of line',
          '  • Ctrl+F / Ctrl+B    Move forward/backward one char',
          '  • Ctrl+U / Ctrl+K    Delete to start/end of line',
          '  • Ctrl+W             Delete word backward',
          '  • Alt+← / Alt+→      Move by word',
          '  • Alt+Backspace      Delete word backward',
          '',
          'IRC COMMANDS:',
          '  • /connect <host> <port> <nick>  Connect to server',
          '  • /join #channel                 Join channel',
          '  • /part [#channel]               Leave channel',
          '  • /msg <nick> <text>             Private message',
          '  • /nick <newnick>                Change nickname',
          '  • /topic [new topic]             Get/set topic',
          '  • /whois <nick>                  User info',
          '  • /away [message]                Set/clear away',
          '  • /quit [reason]                 Quit',
          '',
          'SHORTCUTS:',
          '  • Ctrl+K    Quick actions menu',
          '  • Ctrl+H    Toggle server pane',
          '  • Ctrl+L    Toggle member pane',
          '  • Ctrl+D    Quit application',
          '══════════════════════════════════════════════════════════',
        ]

        // Add each help line as a system message
        if (ctx.currentChannel) {
          const { addMessage } = ctx.store
          for (const line of helpLines) {
            addMessage(ctx.currentChannel.id, {
              id: `help-${Date.now()}-${Math.random()}`,
              type: 'system',
              content: line,
              timestamp: new Date(),
              userId: 'system',
              channelId: ctx.currentChannel.id,
              serverId: ctx.currentServer!.id,
              reactions: [],
              replyMessage: null,
              mentioned: [],
            })
          }
        }

        return { success: true, message: 'Help displayed in chat' }
      },
    })

    this.register({
      name: 'connect',
      aliases: ['server'],
      description: 'Connect to an IRC server',
      usage: '/connect <host> [port] [nickname]',
      minArgs: 1,
      maxArgs: 3,
      execute: async (args, ctx) => {
        const [host, port = '6667', nickname] = args
        await this.registry.execute('server.connectWith', ctx, {
          name: host,
          host,
          port: parseInt(port, 10),
          nickname: nickname ?? 'obbyUser',
        })
        return { success: true, message: `Connecting to ${host}:${port}...` }
      },
    })

    this.register({
      name: 'join',
      aliases: ['j'],
      description: 'Join a channel',
      usage: '/join <#channel>',
      minArgs: 1,
      maxArgs: 1,
      execute: async (args, ctx) => {
        const [channel] = args
        await this.registry.execute('channel.join', ctx, channel)
        return { success: true, message: `Joining ${channel}...` }
      },
    })

    this.register({
      name: 'part',
      aliases: ['leave'],
      description: 'Leave a channel',
      usage: '/part [#channel] [reason]',
      minArgs: 0,
      execute: async (args, ctx) => {
        const [channel, ...reasonParts] = args
        const reason = reasonParts.join(' ')
        const targetChannel = channel ?? ctx.currentChannel?.name

        if (!targetChannel) {
          return { success: false, message: 'No channel specified or current channel' }
        }

        await this.registry.execute('channel.part', ctx, targetChannel, reason)
        return { success: true, message: `Leaving ${targetChannel}...` }
      },
    })

    this.register({
      name: 'msg',
      aliases: ['query', 'privmsg'],
      description: 'Send a private message',
      usage: '/msg <nick> <message>',
      minArgs: 2,
      execute: async (args, ctx) => {
        const [target, ...messageParts] = args
        const message = messageParts.join(' ')
        await this.registry.execute('message.send', ctx, message, target)
        return { success: true }
      },
    })

    this.register({
      name: 'me',
      aliases: ['action'],
      description: 'Send an action message',
      usage: '/me <action>',
      minArgs: 1,
      execute: async (args, ctx) => {
        const action = args.join(' ')
        await this.registry.execute('message.send', ctx, `\u0001ACTION ${action}\u0001`)
        return { success: true }
      },
    })

    this.register({
      name: 'topic',
      aliases: [],
      description: 'Get or set channel topic',
      usage: '/topic [new topic]',
      minArgs: 0,
      execute: async (args, ctx) => {
        if (args.length === 0) {
          await this.registry.execute('channel.topic.get', ctx)
        } else {
          const newTopic = args.join(' ')
          await this.registry.execute('channel.topic.set', ctx, newTopic)
        }
        return { success: true }
      },
    })

    this.register({
      name: 'nick',
      aliases: [],
      description: 'Change nickname',
      usage: '/nick <newnick>',
      minArgs: 1,
      maxArgs: 1,
      execute: async (args, ctx) => {
        const [newNick] = args
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        ctx.ircClient.sendRaw(ctx.currentServer.id, `NICK ${newNick}`)
        return { success: true, message: `Changing nick to ${newNick}...` }
      },
    })

    this.register({
      name: 'quit',
      aliases: ['exit'],
      description: 'Quit the application',
      usage: '/quit [reason]',
      minArgs: 0,
      execute: async (args, ctx) => {
        const reason = args.join(' ') || 'Leaving'
        if (ctx.currentServer && ctx.ircClient) {
          ctx.ircClient.sendRaw(ctx.currentServer.id, `QUIT :${reason}`)
        }
        ctx.renderer.destroy()
        return { success: true, message: 'Quitting...' }
      },
    })

    this.register({
      name: 'whois',
      aliases: [],
      description: 'Get information about a user',
      usage: '/whois <nick>',
      minArgs: 1,
      maxArgs: 1,
      execute: async (args, ctx) => {
        const [nick] = args
        if (!nick) {
          return { success: false, message: 'Usage: /whois <nick>' }
        }
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        ctx.ircClient.whois(ctx.currentServer.id, nick)
        return { success: true, message: `Requesting whois for ${nick}...` }
      },
    })

    this.register({
      name: 'away',
      aliases: [],
      description: 'Set away status',
      usage: '/away [message]',
      minArgs: 0,
      execute: async (args, ctx) => {
        const message = args.join(' ')
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (message) {
          ctx.ircClient.sendRaw(ctx.currentServer.id, `AWAY :${message}`)
          return { success: true, message: `Set away: ${message}` }
        }
        ctx.ircClient.sendRaw(ctx.currentServer.id, 'AWAY')
        return { success: true, message: 'Marked as back' }
      },
    })
  }

  private register(command: IRCCommand): void {
    this.commands.set(command.name, command)
    command.aliases.forEach((alias) => {
      this.commands.set(alias, command)
    })
  }

  async parse(input: string, context: ActionContext<AppStore>): Promise<CommandResult> {
    const trimmed = input.trim()

    if (!trimmed.startsWith('/')) {
      if (!context.currentChannel || !context.currentServer) {
        return { success: false, message: 'No channel selected' }
      }
      await this.registry.execute('message.send', context, trimmed)
      return { success: true }
    }

    const parts = trimmed.slice(1).split(/\s+/)
    const commandName = parts[0]?.toLowerCase()
    if (!commandName) {
      return { success: false, message: 'Invalid command' }
    }

    const args = parts.slice(1)

    const command = this.commands.get(commandName)

    if (!command) {
      return { success: false, message: `Unknown command: /${commandName}` }
    }

    if (args.length < command.minArgs) {
      return {
        success: false,
        message: `Usage: ${command.usage}`,
      }
    }

    if (command.maxArgs !== undefined && args.length > command.maxArgs) {
      return {
        success: false,
        message: `Too many arguments. Usage: ${command.usage}`,
      }
    }

    try {
      return await command.execute(args, context)
    } catch (error) {
      return {
        success: false,
        message: `Error executing command: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  getAllCommands(): IRCCommand[] {
    const unique = new Set<IRCCommand>()
    this.commands.forEach((cmd) => unique.add(cmd))
    return Array.from(unique)
  }

  getCommandNames(): string[] {
    return Array.from(this.commands.keys())
  }
}
