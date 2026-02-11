import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@/actions'
import { registerChannelActions } from '@/actions/channelActions'
import { useStore } from '@/store'
import { MockIRCClient } from '../mocks/mockIRCClient'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

describe('Channel Actions', () => {
  let registry: ActionRegistry<AppStore>
  let mockIRCClient: MockIRCClient
  let context: ActionContext<AppStore>

  beforeEach(() => {
    // Reset store
    useStore.setState({
      servers: [],
      currentServerId: 'server-1',
      currentChannelId: null,
    })

    // Add a mock server to the store
    useStore.getState().addServer({
      id: 'server-1',
      name: 'Test Server',
      host: 'irc.test.com',
      port: 6667,
      nickname: 'testuser',
      isConnected: true,
      connectionState: 'connected',
      channels: [],
      privateChats: [],
    })

    registry = new ActionRegistry<AppStore>()
    registerChannelActions(registry)

    mockIRCClient = new MockIRCClient()
    mockIRCClient.servers.set('server-1', { id: 'server-1', isConnected: true })

    context = {
      store: useStore.getState(),
      ircClient: mockIRCClient as any,
      renderer: {} as any,
      currentServer: useStore.getState().servers[0],
    }
  })

  it('should join a channel and set it as current', async () => {
    // Mock the joinChannel return value
    mockIRCClient.joinChannel = (serverId, channel) =>
      ({
        id: 'channel-1',
        name: channel,
        serverId,
        topic: '',
        isPrivate: false,
        unreadCount: 0,
        isMentioned: false,
        messages: [],
        users: [],
      }) as any

    await registry.execute('channel.join', context, '#test')

    const state = useStore.getState()
    const server = state.servers[0]

    // Check if channel was added to server
    expect(server?.channels).toHaveLength(1)
    expect(server?.channels[0]?.id).toBe('channel-1')
    expect(server?.channels[0]?.name).toBe('#test')

    // Check if channel was selected
    expect(state.currentChannelId).toBe('channel-1')
  })
})
