import type { Action, ActionContext } from '@/types'

export class ActionRegistry<TStore = unknown> {
  private actions = new Map<string, Action<TStore, unknown[]>>()

  register<TParams extends unknown[]>(action: Action<TStore, TParams>): void {
    this.actions.set(action.id, action as Action<TStore, unknown[]>)
  }

  unregister(actionId: string): void {
    this.actions.delete(actionId)
  }

  execute(
    actionId: string,
    context: ActionContext<TStore>,
    ...params: unknown[]
  ): Promise<void> | void {
    const action = this.actions.get(actionId)
    if (!action) {
      throw new Error(`Unknown action: ${actionId}`)
    }

    if (action.isEnabled && !action.isEnabled(context)) {
      return
    }

    return action.execute(context, ...params)
  }

  get(actionId: string): Action<TStore, unknown[]> | undefined {
    return this.actions.get(actionId)
  }

  getAll(): Action<TStore, unknown[]>[] {
    return Array.from(this.actions.values())
  }

  getByCategory(category: string): Action<TStore, unknown[]>[] {
    return this.getAll().filter((action) => action.category === category)
  }

  search(query: string, context: ActionContext<TStore>): Action<TStore, unknown[]>[] {
    const lowerQuery = query.toLowerCase()

    return this.getAll()
      .filter((action) => {
        if (action.isVisible && !action.isVisible(context)) {
          return false
        }

        return (
          action.label.toLowerCase().includes(lowerQuery) ||
          action.description?.toLowerCase().includes(lowerQuery) ||
          action.keywords?.some((k) => k.includes(lowerQuery))
        )
      })
      .sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  findByKeybinding(keybinding: string): Action<TStore, unknown[]> | undefined {
    return this.getAll().find((action) => action.keybinding === keybinding)
  }
}
