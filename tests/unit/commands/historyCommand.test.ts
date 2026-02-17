import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionRegistry } from '@/actions'
import { CommandParser } from '@/services/commands'
import { MockIRCClient } from '../mocks/mockIRCClient'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

const makeContext = (
  overrides: Partial<ActionContext<AppStore>> = {}
): ActionContext<AppStore> => ({
  store: {} as any,
  ircClient: new MockIRCClient() as any,
  renderer: {} as any,
  ...overrides,
})

describe('/history command', () => {
  let parser: CommandParser
  let mockClient: MockIRCClient

  beforeEach(() => {
    mockClient = new MockIRCClient()
    vi.spyOn(mockClient, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('sends CHATHISTORY LATEST with default count of 100', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })

    const result = await parser.parse('/history', ctx)

    expect(result.success).toBe(true)
    expect(mockClient.sendRaw).toHaveBeenCalledWith('srv1', 'CHATHISTORY LATEST #general * 100')
  })

  it('sends CHATHISTORY LATEST with specified count', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })

    const result = await parser.parse('/history 50', ctx)

    expect(result.success).toBe(true)
    expect(mockClient.sendRaw).toHaveBeenCalledWith('srv1', 'CHATHISTORY LATEST #general * 50')
  })

  it('fails when no server connected', async () => {
    const ctx = makeContext({ ircClient: mockClient as any })
    const result = await parser.parse('/history', ctx)
    expect(result.success).toBe(false)
  })

  it('fails when no channel active', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
    })
    const result = await parser.parse('/history', ctx)
    expect(result.success).toBe(false)
  })

  it('fails with invalid count', async () => {
    const ctx = makeContext({
      ircClient: mockClient as any,
      currentServer: { id: 'srv1', nickname: 'me' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/history abc', ctx)
    expect(result.success).toBe(false)
  })
})
