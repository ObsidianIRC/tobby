import { useStore } from '../store'
import type { IRCClient } from './ircClient'

export async function autoConnectServers(ircClient: IRCClient) {
  const { servers } = useStore.getState()

  debugLog?.('autoConnectServers called, servers:', servers.length)

  for (const server of servers) {
    try {
      debugLog?.(
        `Auto-connecting to ${server.name} (${server.host}:${server.port}) nick=${server.nickname} id=${server.id}`
      )

      await ircClient.connect(
        server.name,
        server.host,
        server.port,
        server.nickname,
        server.password,
        server.saslUsername,
        server.saslPassword,
        server.id
      )

      debugLog?.(`Connect call completed for ${server.name}`)
      // Channel joining is handled in the 'ready' event handler in ircSlice.ts
      // so that channels are joined only after the IRC connection is fully registered.
    } catch (error) {
      debugLog?.(`Failed to auto-connect to ${server.name}:`, error)
    }
  }
}
