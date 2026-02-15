import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from '@/store'

/**
 * Integration tests for IRC flow
 * Tests the store operations that would occur during IRC operations
 */
describe('IRC Integration - Store Flow', () => {
  beforeEach(() => {
    // Reset store state before each test
    const store = useStore
    const state = store.getState()

    // Clear all servers
    state.servers.forEach((s) => {
      store.getState().removeServer(s.id)
    })

    // Clear all messages
    state.messages.forEach((_, channelId) => {
      store.getState().clearMessages(channelId)
    })

    // Reset UI state
    store.getState().setCurrentServer(null)
    store.getState().setCurrentChannel(null)
    store.getState().setFocusedChannel(null)
  })

  describe('Server Connection Flow', () => {
    it('should add a server to the store', () => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: false,
        connectionState: 'connecting',
        channels: [],
        privateChats: [],
      })

      const servers = useStore.getState().servers
      expect(servers).toHaveLength(1)
      expect(servers[0]).toMatchObject({
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        isConnected: false,
        connectionState: 'connecting',
      })
    })

    it('should update server connection state', () => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: false,
        connectionState: 'connecting',
        channels: [],
        privateChats: [],
      })

      useStore.getState().updateServer('server-1', {
        isConnected: true,
        connectionState: 'connected',
      })

      const server = useStore.getState().getServer('server-1')
      expect(server).toBeDefined()
      expect(server?.isConnected).toBe(true)
      expect(server?.connectionState).toBe('connected')
    })

    it('should handle reconnection state', () => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: true,
        connectionState: 'connected',
        channels: [],
        privateChats: [],
      })

      // Simulate disconnection
      useStore.getState().updateServer('server-1', {
        isConnected: false,
        connectionState: 'reconnecting',
      })

      const server = useStore.getState().getServer('server-1')
      expect(server?.connectionState).toBe('reconnecting')

      // Simulate successful reconnection
      useStore.getState().updateServer('server-1', {
        isConnected: true,
        connectionState: 'connected',
      })

      const reconnectedServer = useStore.getState().getServer('server-1')
      expect(reconnectedServer?.isConnected).toBe(true)
      expect(reconnectedServer?.connectionState).toBe('connected')
    })

    it('should remove a server from the store', () => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: true,
        connectionState: 'connected',
        channels: [],
        privateChats: [],
      })

      expect(useStore.getState().servers).toHaveLength(1)

      useStore.getState().removeServer('server-1')

      expect(useStore.getState().servers).toHaveLength(0)
      expect(useStore.getState().getServer('server-1')).toBeUndefined()
    })
  })

  describe('Channel Operations', () => {
    beforeEach(() => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: true,
        connectionState: 'connected',
        channels: [],
        privateChats: [],
      })
    })

    it('should add a channel to a server', () => {
      useStore.getState().addChannel('server-1', {
        id: 'channel-1',
        name: '#test',
        serverId: 'server-1',
        topic: '',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      })

      const server = useStore.getState().getServer('server-1')
      expect(server?.channels).toHaveLength(1)
      expect(server?.channels[0]?.name).toBe('#test')
    })

    it('should update channel topic and unread count', () => {
      useStore.getState().addChannel('server-1', {
        id: 'channel-1',
        name: '#test',
        serverId: 'server-1',
        topic: '',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      })

      useStore.getState().updateChannel('server-1', 'channel-1', {
        topic: 'New topic for testing',
        unreadCount: 5,
        isMentioned: true,
      })

      const channel = useStore.getState().getChannel('server-1', 'channel-1')
      expect(channel?.topic).toBe('New topic for testing')
      expect(channel?.unreadCount).toBe(5)
      expect(channel?.isMentioned).toBe(true)
    })

    it('should remove a channel from a server', () => {
      useStore.getState().addChannel('server-1', {
        id: 'channel-1',
        name: '#test',
        serverId: 'server-1',
        topic: '',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      })

      expect(useStore.getState().getServer('server-1')?.channels).toHaveLength(1)

      useStore.getState().removeChannel('server-1', 'channel-1')

      expect(useStore.getState().getServer('server-1')?.channels).toHaveLength(0)
      expect(useStore.getState().getChannel('server-1', 'channel-1')).toBeUndefined()
    })
  })

  describe('Message Operations', () => {
    beforeEach(() => {
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Test Server',
        host: 'irc.example.com',
        port: 6697,
        nickname: 'testuser',
        isConnected: true,
        connectionState: 'connected',
        channels: [],
        privateChats: [],
      })

      useStore.getState().addChannel('server-1', {
        id: 'channel-1',
        name: '#test',
        serverId: 'server-1',
        topic: '',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      })
    })

    it('should add a message to a channel', () => {
      const message = {
        id: 'msg-1',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'user1',
        content: 'Hello, world!',
        timestamp: new Date(),
        type: 'message' as const,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }

      useStore.getState().addMessage('channel-1', message)

      const messages = useStore.getState().getMessages('channel-1')
      expect(messages).toHaveLength(1)
      expect(messages[0]?.content).toBe('Hello, world!')
    })

    it('should add multiple messages in order', () => {
      const message1 = {
        id: 'msg-1',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'user1',
        content: 'First message',
        timestamp: new Date('2024-01-01T10:00:00'),
        type: 'message' as const,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }

      const message2 = {
        id: 'msg-2',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'user2',
        content: 'Second message',
        timestamp: new Date('2024-01-01T10:01:00'),
        type: 'message' as const,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }

      useStore.getState().addMessage('channel-1', message1)
      useStore.getState().addMessage('channel-1', message2)

      const messages = useStore.getState().getMessages('channel-1')
      expect(messages).toHaveLength(2)
      expect(messages[0]?.content).toBe('First message')
      expect(messages[1]?.content).toBe('Second message')
    })

    it('should clear messages for a channel', () => {
      const message = {
        id: 'msg-1',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'user1',
        content: 'Hello',
        timestamp: new Date(),
        type: 'message' as const,
        reactions: [],
        replyMessage: null,
        mentioned: [],
      }

      useStore.getState().addMessage('channel-1', message)
      expect(useStore.getState().getMessages('channel-1')).toHaveLength(1)

      useStore.getState().clearMessages('channel-1')
      expect(useStore.getState().getMessages('channel-1')).toHaveLength(0)
    })
  })

  describe('Complete IRC Flow', () => {
    it('should complete a full connect → join → message → disconnect flow', () => {
      // Step 1: Connect to server
      useStore.getState().addServer({
        id: 'server-1',
        name: 'Libera.Chat',
        host: 'irc.libera.chat',
        port: 6697,
        nickname: 'testuser',
        isConnected: false,
        connectionState: 'connecting',
        channels: [],
        privateChats: [],
      })

      expect(useStore.getState().servers).toHaveLength(1)

      // Step 2: Successfully connected
      useStore.getState().updateServer('server-1', {
        isConnected: true,
        connectionState: 'connected',
      })

      expect(useStore.getState().getServer('server-1')?.isConnected).toBe(true)

      // Step 3: Join a channel
      useStore.getState().addChannel('server-1', {
        id: 'channel-1',
        name: '#opensource',
        serverId: 'server-1',
        topic: 'Open source discussion',
        users: [],
        messages: [],
        unreadCount: 0,
        isPrivate: false,
        isMentioned: false,
      })

      expect(useStore.getState().getServer('server-1')?.channels).toHaveLength(1)

      // Step 4: Receive messages
      useStore.getState().addMessage('channel-1', {
        id: 'msg-1',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'alice',
        content: 'Welcome to #opensource!',
        timestamp: new Date(),
        type: 'message',
        reactions: [],
        replyMessage: null,
        mentioned: [],
      })

      useStore.getState().addMessage('channel-1', {
        id: 'msg-2',
        channelId: 'channel-1',
        serverId: 'server-1',
        userId: 'testuser',
        content: 'Thanks! Happy to be here.',
        timestamp: new Date(),
        type: 'message',
        reactions: [],
        replyMessage: null,
        mentioned: [],
      })

      expect(useStore.getState().getMessages('channel-1')).toHaveLength(2)

      // Step 5: Leave channel
      useStore.getState().removeChannel('server-1', 'channel-1')

      expect(useStore.getState().getServer('server-1')?.channels).toHaveLength(0)

      // Step 6: Disconnect from server
      useStore.getState().updateServer('server-1', {
        isConnected: false,
        connectionState: 'disconnected',
      })

      const finalServer = useStore.getState().getServer('server-1')
      expect(finalServer?.isConnected).toBe(false)
      expect(finalServer?.connectionState).toBe('disconnected')
    })
  })
})
