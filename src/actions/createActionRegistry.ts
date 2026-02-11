import { ActionRegistry } from './index';
import { registerServerActions } from './serverActions';
import { registerChannelActions } from './channelActions';
import { registerMessageActions } from './messageActions';
import type { AppStore } from '../store';

export function createActionRegistry(): ActionRegistry<AppStore> {
  const registry = new ActionRegistry<AppStore>();

  registerServerActions(registry);
  registerChannelActions(registry);
  registerMessageActions(registry);

  return registry;
}
