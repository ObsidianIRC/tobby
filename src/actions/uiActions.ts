import type { ActionRegistry } from './index'
import type { AppStore } from '@/store'

export function registerUIActions(registry: ActionRegistry<AppStore>) {
  registry.register({
    id: 'ui.toggleServerPane',
    label: 'Toggle Server List',
    description: 'Show or hide the server list',
    category: 'ui',
    keywords: ['server', 'sidebar', 'list', 'toggle', 'hide', 'show'],
    priority: 64,

    isEnabled: () => true,
    isVisible: () => true,

    execute: (ctx) => {
      ctx.store.toggleServerPane()
    },
  })

  registry.register({
    id: 'ui.toggleUserPane',
    label: 'Toggle Members Sidebar',
    description: 'Show or hide the members list',
    category: 'ui',
    keybinding: 'ctrl+g',
    keywords: ['members', 'sidebar', 'users', 'toggle', 'hide', 'show'],
    priority: 65,

    isEnabled: () => true,
    isVisible: () => true,

    execute: (ctx) => {
      ctx.store.toggleUserPane()
    },
  })

  registry.register({
    id: 'ui.toggleTimestamps',
    label: 'Toggle Timestamps',
    description: 'Show or hide message timestamps',
    category: 'ui',
    keywords: ['timestamps', 'time', 'clock', 'toggle', 'hide', 'show'],
    priority: 63,

    isEnabled: () => true,
    isVisible: () => true,

    execute: (ctx) => {
      ctx.store.toggleShowTimestamps()
    },
  })

  registry.register({
    id: 'ui.toggleExpandMultilines',
    label: 'Toggle Multiline Expand',
    description: 'Expand or collapse all multiline messages',
    category: 'ui',
    keybinding: 'ctrl+o',
    keywords: ['multiline', 'expand', 'collapse', 'toggle', 'ml'],
    priority: 60,

    isEnabled: () => true,
    isVisible: () => true,

    execute: (ctx) => {
      ctx.store.toggleExpandMultilines()
    },
  })
}
