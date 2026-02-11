import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionRegistry } from '@/actions'
import { registerServerActions } from '@/actions/serverActions'
import { useStore } from '@/store'
import { MockIRCClient } from '../mocks/mockIRCClient'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

describe('Server Actions', () => {
  let registry: ActionRegistry<AppStore>
  let mockIRCClient: MockIRCClient
  let context: ActionContext<AppStore>

  beforeEach(() => {
    // Reset store
    useStore.setState({
      servers: [],
      currentServerId: null,
      currentChannelId: null,
    })

    registry = new ActionRegistry<AppStore>()
    registerServerActions(registry)

    mockIRCClient = new MockIRCClient()

    context = {
      store: useStore.getState(),
      ircClient: mockIRCClient as any, // Cast to any to bypass full interface requirement for mock
      renderer: {} as any,
    }
  })

  it('should connect to a server and set it as current', async () => {
    const params = {
      name: 'Test Server',
      host: 'irc.test.com',
      port: 6667,
      nickname: 'testuser',
    }

    await registry.execute('server.connectWith', context, params)

    const state = useStore.getState()

    // Check if server was added
    expect(state.servers).toHaveLength(1)
    expect(state.servers[0].name).toBe('Test Server')

    // THIS IS THE BUG: verify that currentServerId is set to the new server
    expect(state.currentServerId).toBe(state.servers[0].id)
  })
})
