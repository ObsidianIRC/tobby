import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionRegistry } from '@/actions'
import { CommandParser } from '@/services/commands'
import { MockIRCClient } from '../mocks/mockIRCClient'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

const makeStore = () => {
  const messages: Record<string, any[]> = {}
  return {
    addMessage: vi.fn((channelId: string, msg: any) => {
      messages[channelId] = [...(messages[channelId] ?? []), msg]
    }),
    getMessages: (channelId: string) => messages[channelId] ?? [],
  }
}

const makeContext = (
  overrides: Partial<ActionContext<AppStore>> = {}
): ActionContext<AppStore> => ({
  store: makeStore() as any,
  ircClient: new MockIRCClient() as any,
  renderer: {} as any,
  ...overrides,
})

describe('/whisper command', () => {
  let parser: CommandParser
  let mockClient: MockIRCClient

  beforeEach(() => {
    mockClient = new MockIRCClient()
    vi.spyOn(mockClient, 'sendWhisper')
    parser = new CommandParser(new ActionRegistry())
  })

  it('calls sendWhisper with correct arguments', async () => {
    const store = makeStore()
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
      store: store as any,
    })

    const result = await parser.parse('/whisper alice hello there', ctx)

    expect(result.success).toBe(true)
    expect(mockClient.sendWhisper).toHaveBeenCalledWith('srv1', 'alice', '#general', 'hello there')
  })

  it('adds a local whisper message to the channel', async () => {
    const store = makeStore()
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
      store: store as any,
    })

    await parser.parse('/whisper bob secret message', ctx)

    expect(store.addMessage).toHaveBeenCalledOnce()
    const [channelId, msg] = (store.addMessage as any).mock.calls[0]
    expect(channelId).toBe('ch1')
    expect(msg.type).toBe('whisper')
    expect(msg.content).toContain('bob')
    expect(msg.content).toContain('secret message')
  })

  it('fails without enough arguments', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })

    const result = await parser.parse('/whisper alice', ctx)
    expect(result.success).toBe(false)
  })

  it('fails when no channel active', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
    })

    const result = await parser.parse('/whisper alice hello', ctx)
    expect(result.success).toBe(false)
  })

  it('supports /w alias', async () => {
    const store = makeStore()
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#test' } as any,
      store: store as any,
    })

    const result = await parser.parse('/w alice hey', ctx)
    expect(result.success).toBe(true)
    expect(mockClient.sendWhisper).toHaveBeenCalledWith('srv1', 'alice', '#test', 'hey')
  })
})
