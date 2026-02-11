import { describe, it, expect, beforeEach } from 'vitest'
import { ActionRegistry } from '@/actions'
import type { Action, ActionContext } from '@/types'

describe('ActionRegistry', () => {
  let registry: ActionRegistry
  let mockContext: ActionContext

  beforeEach(() => {
    registry = new ActionRegistry()
    mockContext = {
      store: null,
      ircClient: {} as ActionContext['ircClient'],
      renderer: {} as ActionContext['renderer'],
    }
  })

  describe('register', () => {
    it('should register an action', () => {
      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        execute: () => {},
      }

      registry.register(action)
      expect(registry.get('test.action')).toBe(action)
    })

    it('should replace existing action with same id', () => {
      const action1: Action = {
        id: 'test.action',
        label: 'Action 1',
        category: 'system',
        execute: () => {},
      }

      const action2: Action = {
        id: 'test.action',
        label: 'Action 2',
        category: 'system',
        execute: () => {},
      }

      registry.register(action1)
      registry.register(action2)

      const registered = registry.get('test.action')
      expect(registered?.label).toBe('Action 2')
    })
  })

  describe('unregister', () => {
    it('should unregister an action', () => {
      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        execute: () => {},
      }

      registry.register(action)
      registry.unregister('test.action')

      expect(registry.get('test.action')).toBeUndefined()
    })
  })

  describe('execute', () => {
    it('should execute an action', () => {
      let executed = false

      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        execute: () => {
          executed = true
        },
      }

      registry.register(action)
      registry.execute('test.action', mockContext)

      expect(executed).toBe(true)
    })

    it('should throw error for unknown action', () => {
      expect(() => registry.execute('unknown.action', mockContext)).toThrow(
        'Unknown action: unknown.action'
      )
    })

    it('should not execute disabled action', () => {
      let executed = false

      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        execute: () => {
          executed = true
        },
        isEnabled: () => false,
      }

      registry.register(action)
      registry.execute('test.action', mockContext)

      expect(executed).toBe(false)
    })

    it('should execute enabled action', () => {
      let executed = false

      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        execute: () => {
          executed = true
        },
        isEnabled: () => true,
      }

      registry.register(action)
      registry.execute('test.action', mockContext)

      expect(executed).toBe(true)
    })
  })

  describe('getAll', () => {
    it('should return all registered actions', () => {
      const action1: Action = {
        id: 'test.action1',
        label: 'Action 1',
        category: 'system',
        execute: () => {},
      }

      const action2: Action = {
        id: 'test.action2',
        label: 'Action 2',
        category: 'server',
        execute: () => {},
      }

      registry.register(action1)
      registry.register(action2)

      const actions = registry.getAll()
      expect(actions).toHaveLength(2)
      expect(actions).toContain(action1)
      expect(actions).toContain(action2)
    })
  })

  describe('getByCategory', () => {
    it('should return actions by category', () => {
      const systemAction: Action = {
        id: 'system.action',
        label: 'System Action',
        category: 'system',
        execute: () => {},
      }

      const serverAction: Action = {
        id: 'server.action',
        label: 'Server Action',
        category: 'server',
        execute: () => {},
      }

      registry.register(systemAction)
      registry.register(serverAction)

      const systemActions = registry.getByCategory('system')
      expect(systemActions).toHaveLength(1)
      expect(systemActions[0]).toBe(systemAction)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      registry.register({
        id: 'action.connect',
        label: 'Connect to Server',
        description: 'Connect to an IRC server',
        category: 'server',
        keywords: ['connect', 'server', 'join'],
        priority: 100,
        execute: () => {},
      })

      registry.register({
        id: 'action.disconnect',
        label: 'Disconnect',
        description: 'Disconnect from server',
        category: 'server',
        keywords: ['disconnect', 'leave'],
        priority: 50,
        execute: () => {},
      })

      registry.register({
        id: 'action.join',
        label: 'Join Channel',
        description: 'Join a channel',
        category: 'channel',
        keywords: ['join', 'channel'],
        priority: 75,
        execute: () => {},
      })
    })

    it('should find actions by label', () => {
      const results = registry.search('connect to', mockContext)
      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe('action.connect')
    })

    it('should find actions by description', () => {
      const results = registry.search('irc server', mockContext)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]?.id).toBe('action.connect')
    })

    it('should find actions by keywords', () => {
      const results = registry.search('leave', mockContext)
      expect(results).toHaveLength(1)
      expect(results[0]?.id).toBe('action.disconnect')
    })

    it('should sort by priority', () => {
      const results = registry.search('', mockContext)
      expect(results[0]?.id).toBe('action.connect')
      expect(results[1]?.id).toBe('action.join')
      expect(results[2]?.id).toBe('action.disconnect')
    })

    it('should filter invisible actions', () => {
      registry.register({
        id: 'action.hidden',
        label: 'Hidden Action',
        category: 'system',
        execute: () => {},
        isVisible: () => false,
      })

      const results = registry.search('hidden', mockContext)
      expect(results).toHaveLength(0)
    })

    it('should include visible actions', () => {
      registry.register({
        id: 'action.visible',
        label: 'Visible Action',
        category: 'system',
        execute: () => {},
        isVisible: () => true,
      })

      const results = registry.search('visible', mockContext)
      expect(results).toHaveLength(1)
    })
  })

  describe('findByKeybinding', () => {
    it('should find action by keybinding', () => {
      const action: Action = {
        id: 'test.action',
        label: 'Test Action',
        category: 'system',
        keybinding: 'ctrl+k',
        execute: () => {},
      }

      registry.register(action)
      const found = registry.findByKeybinding('ctrl+k')

      expect(found).toBe(action)
    })

    it('should return undefined for unknown keybinding', () => {
      const found = registry.findByKeybinding('ctrl+unknown')
      expect(found).toBeUndefined()
    })
  })
})
