import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@/actions'
import { registerUIActions } from '@/actions/uiActions'
import { CommandParser } from '@/services/commands'
import { useStore } from '@/store'
import type { ActionContext } from '@/types'
import type { AppStore } from '@/store'

const makeContext = (): ActionContext<AppStore> => ({
  store: useStore.getState(),
  ircClient: null as any,
  renderer: {} as any,
})

describe('/members command', () => {
  let parser: CommandParser

  beforeEach(() => {
    useStore.setState({ showUserPane: true })
    const registry = new ActionRegistry<AppStore>()
    registerUIActions(registry)
    parser = new CommandParser(registry)
  })

  it('hides user pane when visible', async () => {
    const result = await parser.parse('/members', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showUserPane).toBe(false)
  })

  it('shows user pane when hidden', async () => {
    useStore.setState({ showUserPane: false })
    const result = await parser.parse('/members', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showUserPane).toBe(true)
  })

  it('/users alias works', async () => {
    const result = await parser.parse('/users', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showUserPane).toBe(false)
  })

  it('does not affect server pane', async () => {
    useStore.setState({ showServerPane: true })
    await parser.parse('/members', makeContext())
    expect(useStore.getState().showServerPane).toBe(true)
  })

  it('rejects extra arguments', async () => {
    const result = await parser.parse('/members extra', makeContext())
    expect(result.success).toBe(false)
  })
})

describe('/tree command', () => {
  let parser: CommandParser

  beforeEach(() => {
    useStore.setState({ showServerPane: true })
    const registry = new ActionRegistry<AppStore>()
    registerUIActions(registry)
    parser = new CommandParser(registry)
  })

  it('hides server pane when visible', async () => {
    const result = await parser.parse('/tree', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showServerPane).toBe(false)
  })

  it('shows server pane when hidden', async () => {
    useStore.setState({ showServerPane: false })
    const result = await parser.parse('/tree', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showServerPane).toBe(true)
  })

  it('does not affect member pane', async () => {
    useStore.setState({ showUserPane: true })
    await parser.parse('/tree', makeContext())
    expect(useStore.getState().showUserPane).toBe(true)
  })

  it('rejects extra arguments', async () => {
    const result = await parser.parse('/tree extra', makeContext())
    expect(result.success).toBe(false)
  })
})
