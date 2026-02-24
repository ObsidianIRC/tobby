import { v4 as uuidv4 } from 'uuid'
import { checkServerRestriction, checkNickRestriction } from '@/utils/restrictions'
import { createMessage } from '@/utils/messageFactory'
import type { ActionRegistry } from '@/actions'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

interface CommandResult {
  success: boolean
  message?: string
}

interface IRCCommand {
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
          '  • /msg <target> <text>           Send message to nick or channel',
          '  • /notice <target> <text>        Send a NOTICE to nick or channel',
          '  • /ns /cs /os <cmd>              Shorthand for NickServ/ChanServ/OperServ',
          '  • /query <nick> [text]           Open PM window (optionally send message)',
          '  • /nick <newnick>                Change nickname',
          '  • /topic [new topic]             Get/set topic',
          '  • /whois <nick>                  User info',
          '  • /close                         Close current DM window',
          '  • /names                         List users in channel',
          '  • /away [message]                Set/clear away',
          '  • /quit [reason]                 Quit',
          '  • /disconnect                    Disconnect and remove current server',
          '  • /mode [#chan] [+/-modes] [args] Set channel/user modes',
          '  • /op <nick> [nick ...]          Give operator status',
          '  • /deop <nick> [nick ...]        Remove operator status',
          '  • /voice <nick> [nick ...]       Give voice',
          '  • /devoice <nick> [nick ...]     Remove voice',
          '  • /quote <raw line>              Send raw IRC line to server',
          '',
          'SHORTCUTS:',
          '  • Ctrl+K    Quick actions menu',
          '  • Ctrl+L    Clear current buffer',
          '  • Ctrl+G    Toggle member pane',
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
            addMessage(
              ctx.currentChannel.id,
              createMessage('system', line, 'system', ctx.currentChannel.id, ctx.currentServer!.id)
            )
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
        const serverErr = checkServerRestriction(host!)
        if (serverErr) return { success: false, message: serverErr }
        if (nickname) {
          const nickErr = checkNickRestriction(nickname)
          if (nickErr) return { success: false, message: nickErr }
        }
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
      aliases: ['privmsg'],
      description: 'Send a message to a nick or channel',
      usage: '/msg <target> <message>',
      minArgs: 2,
      execute: async (args, ctx) => {
        const target = args[0]!
        const message = args.slice(1).join(' ')
        const { ircClient, currentServer } = ctx
        if (!ircClient || !currentServer) {
          return { success: false, message: 'Not connected to a server' }
        }
        ircClient.sendRaw(currentServer.id, `PRIVMSG ${target} :${message}`)
        const hasEchoMessage = currentServer.capabilities?.includes('echo-message') ?? false
        if (!hasEchoMessage) {
          const isChannel = target.startsWith('#') || target.startsWith('&')
          if (isChannel) {
            const channel = currentServer.channels.find(
              (c) => c.name.toLowerCase() === target.toLowerCase()
            )
            if (channel) {
              ctx.store.addMessage(
                channel.id,
                createMessage(
                  'message',
                  message,
                  currentServer.nickname,
                  channel.id,
                  currentServer.id
                )
              )
            }
          } else {
            const existing = currentServer.privateChats.find(
              (pc) => pc.username.toLowerCase() === target.toLowerCase()
            )
            const pm = existing ?? {
              id: uuidv4(),
              username: target,
              serverId: currentServer.id,
              unreadCount: 0,
              isMentioned: false,
            }
            if (!existing) {
              ctx.store.addPrivateChat(currentServer.id, pm)
            }
            ctx.store.addMessage(
              pm.id,
              createMessage('message', message, currentServer.nickname, pm.id, currentServer.id)
            )
          }
        }
        return { success: true }
      },
    })

    this.register({
      name: 'query',
      aliases: ['q'],
      description: 'Open a private chat window with a user',
      usage: '/query <nick> [message]',
      minArgs: 1,
      execute: async (args, ctx) => {
        const nick = args[0]!
        const messageParts = args.slice(1)
        const { ircClient, currentServer } = ctx
        if (!ircClient || !currentServer) {
          return { success: false, message: 'Not connected to a server' }
        }
        const existing = currentServer.privateChats.find(
          (pc) => pc.username.toLowerCase() === nick.toLowerCase()
        )
        const pm = existing ?? {
          id: uuidv4(),
          username: nick,
          serverId: currentServer.id,
          unreadCount: 0,
          isMentioned: false,
        }
        if (!existing) {
          ctx.store.addPrivateChat(currentServer.id, pm)
        }
        ctx.store.setCurrentChannel(pm.id)
        if (messageParts.length > 0) {
          const message = messageParts.join(' ')
          ircClient.sendRaw(currentServer.id, `PRIVMSG ${nick} :${message}`)
          const hasEchoMessage = currentServer.capabilities?.includes('echo-message') ?? false
          if (!hasEchoMessage) {
            ctx.store.addMessage(
              pm.id,
              createMessage('message', message, currentServer.nickname, pm.id, currentServer.id)
            )
          }
        }
        return { success: true }
      },
    })

    this.register({
      name: 'notice',
      aliases: [],
      description: 'Send a NOTICE to a nick or channel',
      usage: '/notice <target> <message>',
      minArgs: 2,
      execute: async (args, ctx) => {
        const [target, ...messageParts] = args
        const message = messageParts.join(' ')
        const { ircClient, currentServer } = ctx
        if (!ircClient || !currentServer) {
          return { success: false, message: 'Not connected to a server' }
        }
        ircClient.sendRaw(currentServer.id, `NOTICE ${target} :${message}`)
        return { success: true }
      },
    })

    for (const [name, service] of [
      ['ns', 'NickServ'],
      ['cs', 'ChanServ'],
      ['os', 'OperServ'],
    ] as const) {
      this.register({
        name,
        aliases: [],
        description: `Send a message to ${service}`,
        usage: `/${name} <command> [args]`,
        minArgs: 1,
        execute: async (args, ctx) => {
          const { ircClient, currentServer } = ctx
          if (!ircClient || !currentServer) {
            return { success: false, message: 'Not connected to a server' }
          }
          ircClient.sendRaw(currentServer.id, `PRIVMSG ${service} :${args.join(' ')}`)
          return { success: true }
        },
      })
    }

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
            ctx.store.addMessage(
              privateChat.id,
              createMessage(
                'action',
                action,
                currentServer.nickname,
                privateChat.id,
                currentServer.id
              )
            )
          }
          return { success: true }
        }

        if (!currentChannel) {
          return { success: false, message: 'No channel selected' }
        }
        ircClient.sendMessage(currentServer.id, currentChannel.id, `\u0001ACTION ${action}\u0001`)
        if (!hasEchoMessage) {
          ctx.store.addMessage(
            currentChannel.id,
            createMessage(
              'action',
              action,
              currentServer.nickname,
              currentChannel.id,
              currentServer.id
            )
          )
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
        const nickErr = checkNickRestriction(newNick!)
        if (nickErr) return { success: false, message: nickErr }
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
      name: 'close',
      aliases: [],
      description: 'Close the current DM window',
      usage: '/close',
      minArgs: 0,
      maxArgs: 0,
      execute: async (_, ctx) => {
        const { currentServerId, currentChannelId, servers } = ctx.store
        if (!currentServerId || !currentChannelId) {
          return { success: false, message: 'No DM window open' }
        }
        const server = servers.find((s) => s.id === currentServerId)
        const pm = server?.privateChats.find((pc) => pc.id === currentChannelId)
        if (!pm) {
          return { success: false, message: 'Current buffer is not a DM' }
        }
        ctx.store.removePrivateChat(currentServerId, pm.id)
        ctx.store.setCurrentChannel(null)
        return { success: true }
      },
    })

    this.register({
      name: 'names',
      aliases: [],
      description: 'List users in the current channel',
      usage: '/names',
      minArgs: 0,
      maxArgs: 0,
      execute: async (_, ctx) => {
        if (!ctx.currentChannel) {
          return { success: false, message: 'No channel selected' }
        }
        const { users } = ctx.currentChannel
        if (users.length === 0) {
          ctx.store.addMessage(
            ctx.currentChannel.id,
            createMessage(
              'system',
              `Users in ${ctx.currentChannel.name}: (none)`,
              'server',
              ctx.currentChannel.id,
              ctx.currentChannel.serverId
            )
          )
          return { success: true }
        }
        const formatted = users
          .map((u) => (u.status ? `${u.status}${u.username}` : u.username))
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
          .join('  ')
        ctx.store.addMessage(
          ctx.currentChannel.id,
          createMessage(
            'system',
            `Users in ${ctx.currentChannel.name} [${users.length}]: ${formatted}`,
            'server',
            ctx.currentChannel.id,
            ctx.currentChannel.serverId
          )
        )
        return { success: true }
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
      name: 'mode',
      aliases: [],
      description: 'Set or query channel/user modes',
      usage: '/mode [#channel] [+/-modes] [args...]',
      minArgs: 0,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }

        // /mode with no args — query current channel modes
        if (args.length === 0) {
          if (!ctx.currentChannel) {
            return { success: false, message: 'No active channel' }
          }
          ctx.ircClient.sendRaw(ctx.currentServer.id, `MODE ${ctx.currentChannel.name}`)
          return { success: true }
        }

        // /mode #channel ... — explicit target; otherwise default to current channel
        let target: string
        let modeArgs: string[]
        if (args[0]!.startsWith('#') || args[0]!.startsWith('&')) {
          target = args[0]!
          modeArgs = args.slice(1)
        } else {
          if (!ctx.currentChannel) {
            return { success: false, message: 'No active channel' }
          }
          target = ctx.currentChannel.name
          modeArgs = args
        }

        if (modeArgs.length === 0) {
          ctx.ircClient.sendRaw(ctx.currentServer.id, `MODE ${target}`)
        } else {
          ctx.ircClient.sendRaw(ctx.currentServer.id, `MODE ${target} ${modeArgs.join(' ')}`)
        }
        return { success: true }
      },
    })

    this.register({
      name: 'op',
      aliases: [],
      description: 'Give operator status to one or more users in the current channel',
      usage: '/op <nick> [nick ...]',
      minArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        const modes = '+' + 'o'.repeat(args.length)
        ctx.ircClient.sendRaw(
          ctx.currentServer.id,
          `MODE ${ctx.currentChannel.name} ${modes} ${args.join(' ')}`
        )
        return { success: true }
      },
    })

    this.register({
      name: 'deop',
      aliases: [],
      description: 'Remove operator status from one or more users in the current channel',
      usage: '/deop <nick> [nick ...]',
      minArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        const modes = '-' + 'o'.repeat(args.length)
        ctx.ircClient.sendRaw(
          ctx.currentServer.id,
          `MODE ${ctx.currentChannel.name} ${modes} ${args.join(' ')}`
        )
        return { success: true }
      },
    })

    this.register({
      name: 'voice',
      aliases: [],
      description: 'Give voice to one or more users in the current channel',
      usage: '/voice <nick> [nick ...]',
      minArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        const modes = '+' + 'v'.repeat(args.length)
        ctx.ircClient.sendRaw(
          ctx.currentServer.id,
          `MODE ${ctx.currentChannel.name} ${modes} ${args.join(' ')}`
        )
        return { success: true }
      },
    })

    this.register({
      name: 'devoice',
      aliases: [],
      description: 'Remove voice from one or more users in the current channel',
      usage: '/devoice <nick> [nick ...]',
      minArgs: 1,
      execute: async (args, ctx) => {
        if (!ctx.currentServer || !ctx.ircClient) {
          return { success: false, message: 'Not connected to a server' }
        }
        if (!ctx.currentChannel) {
          return { success: false, message: 'No active channel' }
        }
        const modes = '-' + 'v'.repeat(args.length)
        ctx.ircClient.sendRaw(
          ctx.currentServer.id,
          `MODE ${ctx.currentChannel.name} ${modes} ${args.join(' ')}`
        )
        return { success: true }
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
          ctx.store.addMessage(
            ctx.currentChannel.id,
            createMessage(
              'whisper',
              `→ ${target}: ${content}`,
              ctx.currentServer.nickname,
              ctx.currentChannel.id,
              ctx.currentServer.id
            )
          )
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
