import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ActionRegistry } from '@/actions'
import { CommandParser } from '@/services/commands'
import { MockIRCClient } from '../mocks/mockIRCClient'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

const makeCtx = (overrides: Partial<ActionContext<AppStore>> = {}): ActionContext<AppStore> => ({
  store: { addMessage: vi.fn() } as any,
  ircClient: new MockIRCClient() as any,
  renderer: {} as any,
  ...overrides,
})

describe('/mode command', () => {
  let parser: CommandParser
  let client: MockIRCClient

  beforeEach(() => {
    client = new MockIRCClient()
    vi.spyOn(client, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('queries current channel modes when called with no args', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general')
  })

  it('returns error with no args when no channel is active', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
    })
    const result = await parser.parse('/mode', ctx)
    expect(result.success).toBe(false)
  })

  it('sets a mode on the current channel', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode +o alice', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +o alice')
  })

  it('sets a mode with no arg (e.g. +m)', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode +m', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +m')
  })

  it('removes a mode on the current channel', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode -v bob', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general -v bob')
  })

  it('accepts an explicit channel as first argument', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode #other +o carol', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #other +o carol')
  })

  it('queries modes for an explicit channel', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/mode #other', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #other')
  })

  it('returns error when not connected', async () => {
    const ctx = makeCtx({ currentChannel: { id: 'ch1', name: '#general' } as any })
    const result = await parser.parse('/mode +o alice', ctx)
    expect(result.success).toBe(false)
  })

  it('returns error for +/- mode when no channel is active', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
    })
    const result = await parser.parse('/mode +o alice', ctx)
    expect(result.success).toBe(false)
  })
})

describe('/op command', () => {
  let parser: CommandParser
  let client: MockIRCClient

  beforeEach(() => {
    client = new MockIRCClient()
    vi.spyOn(client, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('ops a single nick', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/op alice', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +o alice')
  })

  it('ops multiple nicks with stacked modes', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/op alice bob', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +oo alice bob')
  })

  it('fails without a nick', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/op', ctx)
    expect(result.success).toBe(false)
  })
})

describe('/deop command', () => {
  let parser: CommandParser
  let client: MockIRCClient

  beforeEach(() => {
    client = new MockIRCClient()
    vi.spyOn(client, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('deops a single nick', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/deop alice', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general -o alice')
  })

  it('deops multiple nicks', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/deop alice bob', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general -oo alice bob')
  })
})

describe('/voice command', () => {
  let parser: CommandParser
  let client: MockIRCClient

  beforeEach(() => {
    client = new MockIRCClient()
    vi.spyOn(client, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('voices a single nick', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/voice alice', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +v alice')
  })

  it('voices multiple nicks', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/voice alice bob carol', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general +vvv alice bob carol')
  })
})

describe('/devoice command', () => {
  let parser: CommandParser
  let client: MockIRCClient

  beforeEach(() => {
    client = new MockIRCClient()
    vi.spyOn(client, 'sendRaw')
    parser = new CommandParser(new ActionRegistry())
  })

  it('devoices a single nick', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/devoice alice', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general -v alice')
  })

  it('devoices multiple nicks', async () => {
    const ctx = makeCtx({
      ircClient: client as any,
      currentServer: { id: 'srv1' } as any,
      currentChannel: { id: 'ch1', name: '#general' } as any,
    })
    const result = await parser.parse('/devoice alice bob', ctx)
    expect(result.success).toBe(true)
    expect(client.sendRaw).toHaveBeenCalledWith('srv1', 'MODE #general -vv alice bob')
  })
})
