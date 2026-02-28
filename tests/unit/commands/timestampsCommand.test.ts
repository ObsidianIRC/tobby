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

describe('/timestamps command', () => {
  let parser: CommandParser

  beforeEach(() => {
    useStore.setState({ showTimestamps: true, showUserPane: true, showServerPane: true })
    const registry = new ActionRegistry<AppStore>()
    registerUIActions(registry)
    parser = new CommandParser(registry)
  })

  it('hides timestamps when visible', async () => {
    const result = await parser.parse('/timestamps', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showTimestamps).toBe(false)
  })

  it('shows timestamps when hidden', async () => {
    useStore.setState({ showTimestamps: false })
    const result = await parser.parse('/timestamps', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showTimestamps).toBe(true)
  })

  it('/ts alias works', async () => {
    const result = await parser.parse('/ts', makeContext())
    expect(result.success).toBe(true)
    expect(useStore.getState().showTimestamps).toBe(false)
  })

  it('rejects extra arguments', async () => {
    const result = await parser.parse('/timestamps extra', makeContext())
    expect(result.success).toBe(false)
  })

  it('does not affect showUserPane', async () => {
    useStore.setState({ showUserPane: true })
    await parser.parse('/timestamps', makeContext())
    expect(useStore.getState().showUserPane).toBe(true)
  })

  it('does not affect showServerPane', async () => {
    useStore.setState({ showServerPane: true })
    await parser.parse('/timestamps', makeContext())
    expect(useStore.getState().showServerPane).toBe(true)
  })
})
