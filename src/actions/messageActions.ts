import type { ActionContext, Message } from '@/types'
import type { AppStore } from '@/store'
import type { ActionRegistry } from '@/actions'
import { v4 as uuidv4 } from 'uuid'

export function registerMessageActions(registry: ActionRegistry<AppStore>) {
  // Send message
  registry.register({
    id: 'message.send',
    label: 'Send Message',
    description: 'Send a message to the current channel',
    category: 'message',
    keybinding: 'enter',
    keywords: ['send', 'message', 'chat'],
    priority: 100,

    isEnabled: (ctx) => {
      if (ctx.currentChannel) return true
      const server = ctx.currentServer
      if (!server) return false
      return server.privateChats.some((pc) => pc.id === ctx.store.currentChannelId)
    },

    isVisible: () => false,

    execute: async (ctx: ActionContext<AppStore>, content?: string) => {
      const { store, ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer) {
        throw new Error('No server connected')
      }

      if (!content || content.trim() === '') {
        throw new Error('Message content cannot be empty')
      }

      // Check if we're viewing a private chat
      const privateChat = currentServer.privateChats.find((pc) => pc.id === store.currentChannelId)

      debugLog?.(
        'sendMessage action executed with content:',
        content,
        'currentChannel:',
        currentChannel,
        'privateChat:',
        privateChat
      )
      const hasEchoMessage = currentServer.capabilities?.includes('echo-message') ?? false

      const replyingTo = (store as any).replyingTo as Message | null
      const replyTag = replyingTo?.msgid ? `@+draft/reply=${replyingTo.msgid} ` : ''

      if (privateChat) {
        ircClient.sendRaw(
          currentServer.id,
          `${replyTag}PRIVMSG ${privateChat.username} :${content}`
        )
        debugLog?.('Sent private message to', privateChat.username, 'with content:', content)
        // Server will echo the message back via USERMSG if echo-message is active
        if (!hasEchoMessage) {
          const localMessage: Message = {
            id: uuidv4(),
            type: 'message',
            content,
            timestamp: new Date(),
            userId: currentServer.nickname,
            channelId: privateChat.id,
            serverId: currentServer.id,
            reactions: [],
            replyMessage: replyingTo ?? null,
            mentioned: [],
          }
          store.addMessage(privateChat.id, localMessage)
        }
        return
      }

      if (!currentChannel) {
        throw new Error('No channel selected')
      }

      if (replyTag) {
        ircClient.sendRaw(currentServer.id, `${replyTag}PRIVMSG ${currentChannel.name} :${content}`)
      } else {
        ircClient.sendMessage(currentServer.id, currentChannel.id, content)
      }

      // Server will echo the message back via CHANMSG if echo-message is active
      if (!hasEchoMessage) {
        const localMessage: Message = {
          id: uuidv4(),
          type: 'message',
          content,
          timestamp: new Date(),
          userId: currentServer.nickname,
          channelId: currentChannel.id,
          serverId: currentServer.id,
          reactions: [],
          replyMessage: replyingTo ?? null,
          mentioned: [],
        }
        store.addMessage(currentChannel.id, localMessage)
      }
    },
  })

  // Send multiline message
  registry.register({
    id: 'message.sendMultiline',
    label: 'Send Multiline Message',
    description: 'Send a multiline message to the current channel',
    category: 'message',
    keybinding: 'shift+enter',
    keywords: ['send', 'multiline', 'message', 'multi', 'lines'],
    priority: 95,

    isEnabled: (ctx) => {
      return !!ctx.currentChannel && !!ctx.currentServer?.capabilities?.includes('draft/multiline')
    },

    isVisible: () => false,

    execute: async (ctx: ActionContext<AppStore>, content?: string) => {
      const { ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer || !currentChannel) {
        throw new Error('No channel selected')
      }

      if (!content || content.trim() === '') {
        throw new Error('Message content cannot be empty')
      }

      // Check if server supports multiline
      if (!currentServer.capabilities?.includes('draft/multiline')) {
        ircClient.sendMessage(currentServer.id, currentChannel.id, content)
        return
      }

      // Split content into lines
      const lines = content.split('\n')

      // Send as multiline
      ircClient.sendMultilineMessage(currentServer.id, currentChannel.name, lines)
    },
  })

  // Reply to message
  registry.register({
    id: 'message.reply',
    label: 'Reply to Message',
    description: 'Reply to a selected message',
    category: 'message',
    keybinding: 'r',
    keywords: ['reply', 'respond', 'message'],
    priority: 90,

    isEnabled: (ctx) => {
      return !!ctx.selectedMessage && !!ctx.currentChannel
    },

    isVisible: (ctx) => {
      return !!ctx.currentChannel
    },

    execute: async (ctx: ActionContext<AppStore>, content?: string) => {
      const { store, ircClient, currentServer, currentChannel, selectedMessage } = ctx
      if (!ircClient || !currentServer || !currentChannel || !selectedMessage) {
        throw new Error('No message selected to reply to')
      }

      if (!content) {
        // Set replying to state to open reply input
        store.setReplyingTo(selectedMessage)
        return
      }

      // Build message with reply tag if server supports it
      const msgid = selectedMessage.msgid
      if (msgid && currentServer.capabilities?.includes('draft/reply')) {
        // Send with +draft/reply tag
        const replyTag = `+draft/reply=${msgid}`
        ircClient.sendRaw(
          currentServer.id,
          `@${replyTag} PRIVMSG ${currentChannel.name} :${content}`
        )
      } else {
        const mention = `${selectedMessage.userId}: ${content}`
        ircClient.sendMessage(currentServer.id, currentChannel.id, mention)
      }

      // Clear replying to state
      store.setReplyingTo(null)
    },
  })

  // Edit last message (if supported)
  registry.register({
    id: 'message.edit',
    label: 'Edit Message',
    description: 'Edit a previously sent message',
    category: 'message',
    keybinding: 'e',
    keywords: ['edit', 'modify', 'message'],
    priority: 85,

    isEnabled: (ctx) => {
      // Check if editing is supported and user owns the message
      const { currentServer, selectedMessage } = ctx
      const nickname = currentServer?.nickname
      return (
        !!selectedMessage &&
        !!nickname &&
        selectedMessage.userId === nickname &&
        !!currentServer?.capabilities?.includes('draft/edit')
      )
    },

    isVisible: (ctx) => {
      return !!ctx.selectedMessage
    },

    execute: async (ctx: ActionContext<AppStore>, newContent?: string) => {
      const { store, ircClient, currentServer, currentChannel, selectedMessage } = ctx
      if (!ircClient || !currentServer || !currentChannel || !selectedMessage) {
        throw new Error('No message selected to edit')
      }

      if (!newContent) {
        // Open edit modal
        store.openModal('edit-message')
        return
      }

      // Send edited message with edit tag
      const msgid = selectedMessage.msgid
      if (!msgid) {
        throw new Error('Cannot edit message without msgid')
      }

      const editTag = `+draft/edit=${msgid}`
      ircClient.sendRaw(
        currentServer.id,
        `@${editTag} PRIVMSG ${currentChannel.name} :${newContent}`
      )
    },
  })

  // Delete/Redact message
  registry.register({
    id: 'message.delete',
    label: 'Delete Message',
    description: 'Delete a previously sent message',
    category: 'message',
    keybinding: 'd',
    keywords: ['delete', 'remove', 'redact', 'message'],
    priority: 80,

    isEnabled: (ctx) => {
      const { currentServer, selectedMessage } = ctx
      const nickname = currentServer?.nickname
      return (
        !!selectedMessage &&
        !!nickname &&
        selectedMessage.userId === nickname &&
        !!currentServer?.capabilities?.includes('draft/message-redaction')
      )
    },

    isVisible: (ctx) => {
      return !!ctx.selectedMessage
    },

    execute: async (ctx: ActionContext<AppStore>, reason?: string) => {
      const { ircClient, currentServer, currentChannel, selectedMessage } = ctx
      if (!ircClient || !currentServer || !currentChannel || !selectedMessage) {
        throw new Error('No message selected to delete')
      }

      const msgid = selectedMessage.msgid
      if (!msgid) {
        throw new Error('Cannot delete message without msgid')
      }

      // Send REDACT command
      ircClient.sendRedact(currentServer.id, currentChannel.name, msgid, reason)
    },
  })

  // Add reaction to message
  registry.register({
    id: 'message.react',
    label: 'React to Message',
    description: 'Add a reaction to a message',
    category: 'message',
    keybinding: '+',
    keywords: ['react', 'emoji', 'reaction', 'message'],
    priority: 75,

    isEnabled: (ctx) => {
      return !!ctx.selectedMessage && !!ctx.currentServer?.capabilities?.includes('draft/reactions')
    },

    isVisible: (ctx) => {
      return !!ctx.selectedMessage
    },

    execute: async (ctx: ActionContext<AppStore>, emoji?: string) => {
      const { store, ircClient, currentServer, currentChannel, selectedMessage } = ctx
      if (!ircClient || !currentServer || !currentChannel || !selectedMessage) {
        throw new Error('No message selected')
      }

      if (!emoji) {
        // Open emoji picker modal
        store.openModal('emoji-picker')
        return
      }

      const msgid = selectedMessage.msgid
      if (!msgid) {
        throw new Error('Cannot react to message without msgid')
      }

      // Send TAGMSG with +draft/react tag
      const reactTag = `+draft/react=${emoji};+draft/reply=${msgid}`
      ircClient.sendRaw(currentServer.id, `@${reactTag} TAGMSG ${currentChannel.name}`)
    },
  })

  // Show typing indicator
  registry.register({
    id: 'message.typing',
    label: 'Send Typing Indicator',
    description: 'Send typing indicator to the channel',
    category: 'message',
    priority: 70,

    isEnabled: (ctx) => {
      // `+typing` is a client-only tag relayed by any server that supports message-tags,
      // even if the server doesn't explicitly advertise draft/typing in its CAP LS.
      return (
        !!ctx.currentChannel &&
        !!(
          ctx.currentServer?.capabilities?.includes('draft/typing') ||
          ctx.currentServer?.capabilities?.includes('message-tags')
        )
      )
    },

    isVisible: () => false, // Hidden, used programmatically

    execute: async (ctx: ActionContext<AppStore>, isActive?: boolean) => {
      const { ircClient, currentServer, currentChannel } = ctx
      if (!ircClient || !currentServer || !currentChannel) {
        return
      }

      // Send typing indicator
      ircClient.sendTyping(currentServer.id, currentChannel.name, isActive ?? true)
    },
  })
}
