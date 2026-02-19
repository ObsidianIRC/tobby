import { v4 as uuidv4 } from 'uuid'
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
          '             tobby IRC Client - Help                     ',
          '══════════════════════════════════════════════════════════',
          '',
          'INPUT:',
          '  • Paste: Cmd+V (Mac) or Ctrl+Shift+V (Linux)',
          '  • Tab         Complete /commands',
          '  • Ctrl+Enter / Shift+Enter  Add line (multiline message)',
          '  • Up/Down     History nav (1 line) / cursor nav (multiline)',
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
          '  • /query <nick>                  Open PM window with user',
          '  • /nick <newnick>                Change nickname',
          '  • /topic [new topic]             Get/set topic',
          '  • /whois <nick>                  User info',
          '  • /away [message]                Set/clear away',
          '  • /quit [reason]                 Quit',
          '  • /disconnect                    Disconnect and remove current server',
          '  • /quote <raw line>              Send raw IRC line to server',
          '',
          'SHORTCUTS:',
          '  • Ctrl+K    Quick actions menu',
          '  • Ctrl+L    Toggle member pane',
          '  • Ctrl+O    Toggle multiline expand',
          '  • Ctrl+M    Toggle multiline always-on',
          '  • Ctrl+D    Quit (press twice to confirm)',
          '  • Alt+N/P   Next/prev buffer',
          '  • Alt+1..9  Jump to buffer by number',
          '  • Alt+[     Move current server/channel up',
          '  • Alt+]     Move current server/channel down',
          '',
          'MESSAGE SELECTION (Ctrl+Space to toggle):',
          '  • ↑/↓ or J/K  Navigate one message',
          '  • Ctrl+U      Jump 10 messages up',
          '  • R           Reply to selected message',
          '  • E           React with emoji',
          '  • Y           Copy message text',
          '  • Esc         Exit selection mode',
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
        const { ircClient, currentServer, currentChannel } = ctx
        if (!ircClient || !currentServer) {
          return { success: false, message: 'Not connected to a server' }
        }

        const hasEchoMessage = currentServer.capabilities?.includes('echo-message') ?? false

        const privateChat = currentServer.privateChats.find(
          (pc) => pc.id === ctx.store.currentChannelId
        )

        if (privateChat) {
          ircClient.sendRaw(
            currentServer.id,
            `PRIVMSG ${privateChat.username} :\u0001ACTION ${action}\u0001`
          )
          if (!hasEchoMessage) {
            ctx.store.addMessage(privateChat.id, {
              id: uuidv4(),
              type: 'action',
              content: action,
              timestamp: new Date(),
              userId: currentServer.nickname,
              channelId: privateChat.id,
              serverId: currentServer.id,
              reactions: [],
              replyMessage: null,
              mentioned: [],
            })
          }
          return { success: true }
        }

        if (!currentChannel) {
          return { success: false, message: 'No channel selected' }
        }
        ircClient.sendMessage(currentServer.id, currentChannel.id, `\u0001ACTION ${action}\u0001`)
        if (!hasEchoMessage) {
          ctx.store.addMessage(currentChannel.id, {
            id: uuidv4(),
            type: 'action',
            content: action,
            timestamp: new Date(),
            userId: currentServer.nickname,
            channelId: currentChannel.id,
            serverId: currentServer.id,
            reactions: [],
            replyMessage: null,
            mentioned: [],
          })
        }
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
        process.exit(0)
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

    this.register({
      name: 'clear',
      aliases: ['cls'],
      description: 'Clear all messages in the current buffer',
      usage: '/clear',
      minArgs: 0,
      maxArgs: 0,
      execute: async (_, ctx) => {
        const channelId = ctx.currentChannel?.id ?? ctx.store.currentChannelId
        if (!channelId) {
          return { success: false, message: 'No active buffer to clear' }
        }
        ctx.store.clearMessages(channelId)
        return { success: true }
      },
    })

    this.register({
      name: 'history',
      aliases: [],
      description: 'Fetch chat history for the current channel',
      usage: '/history [count]',
      minArgs: 0,
      maxArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        const count = args[0] ? parseInt(args[0], 10) : 100
        if (isNaN(count) || count < 1) {
          return { success: false, message: 'Count must be a positive number' }
        }
        ctx.ircClient.sendRaw(
          ctx.currentServer.id,
          `CHATHISTORY LATEST ${ctx.currentChannel.name} * ${count}`
        )
        return { success: true }
      },
    })

    this.register({
      name: 'quote',
      aliases: ['raw'],
      description: 'Send a raw IRC line to the server',
      usage: '/quote <raw line>',
      minArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        ctx.ircClient.sendRaw(ctx.currentServer.id, args.join(' '))
        return { success: true }
      },
    })

    this.register({
      name: 'query',
      aliases: ['q'],
      description: 'Open a private message window with a user',
      usage: '/query <nick>',
      minArgs: 1,
      maxArgs: 1,
      execute: async (args, ctx) => {
        const nick = args[0]!
        if (!ctx.currentServer) {
          return { success: false, message: 'Not connected to a server' }
        }
        const { currentServer } = ctx
        const existing = currentServer.privateChats.find(
          (pc) => pc.username.toLowerCase() === nick.toLowerCase()
        )
        if (existing) {
          ctx.store.setCurrentChannel(existing.id)
          return { success: true }
        }
        const chat = {
          id: uuidv4(),
          username: nick as string,
          serverId: currentServer.id,
          unreadCount: 0 as number,
          isMentioned: false as boolean,
        }
        ctx.store.addPrivateChat(currentServer.id, chat)
        ctx.store.setCurrentChannel(chat.id)
        return { success: true }
      },
    })

    this.register({
      name: 'disconnect',
      aliases: [],
      description: 'Disconnect from and remove the current server',
      usage: '/disconnect',
      minArgs: 0,
      maxArgs: 0,
      execute: async (_, ctx) => {
        if (!ctx.currentServer) {
          return { success: false, message: 'No server selected' }
        }
        await this.registry.execute('server.disconnectAndRemove', ctx)
        return { success: true }
      },
    })

    this.register({
      name: 'whisper',
      aliases: ['w'],
      description: 'Send an inline private whisper to a user in the current channel',
      usage: '/whisper <nick> <message>',
      minArgs: 2,
      execute: async (args, ctx) => {
        const [target, ...messageParts] = args
        const content = messageParts.join(' ')
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        ;(ctx.ircClient as any).sendWhisper(
          ctx.currentServer.id,
          target,
          ctx.currentChannel.name,
          content
        )
        // If echo-message is active the server will echo our PRIVMSG back through
        // the USERMSG handler which will show it in the channel. Otherwise add locally.
        if (!ctx.currentServer.capabilities?.includes('echo-message')) {
          ctx.store.addMessage(ctx.currentChannel.id, {
            id: uuidv4(),
            type: 'whisper',
            content: `→ ${target}: ${content}`,
            timestamp: new Date(),
            userId: ctx.currentServer.nickname,
            channelId: ctx.currentChannel.id,
            serverId: ctx.currentServer.id,
            reactions: [],
            replyMessage: null,
            mentioned: [],
          })
        }
        return { success: true }
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
      if (!context.currentServer) {
        return { success: false, message: 'No server connected' }
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
