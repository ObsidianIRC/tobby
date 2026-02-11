import { createContext, useContext, useMemo } from 'react';
import type { ActionRegistry } from '../actions';
import type { AppStore } from '../store';
import type { IRCClient } from '../../ObsidianIRC/src/lib/ircClient';
import type { CliRenderer } from '@opentui/core';

interface AppContextValue {
  registry: ActionRegistry<AppStore>;
  ircClient: IRCClient | null;
  renderer: CliRenderer;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  registry: ActionRegistry<AppStore>;
  ircClient: IRCClient | null;
  renderer: CliRenderer;
  children: React.ReactNode;
}

export function AppProvider({ registry, ircClient, renderer, children }: AppProviderProps) {
  const value = useMemo(
    () => ({ registry, ircClient, renderer }),
    [registry, ircClient, renderer]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
