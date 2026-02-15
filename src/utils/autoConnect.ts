import { useStore } from '../store'
import type { IRCClient } from './ircClient'
import { getDatabase } from '../services/database'

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

      debugLog?.(`Connect call completed for ${server.name}, waiting for connection...`)

      // Wait a bit for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 2000))

      debugLog?.(`Connection wait done for ${server.name}, joining channels...`)

      // Auto-join channels
      const db = getDatabase()
      const autoJoinChannels = db.getAutoJoinChannels(server.id)

      debugLog?.(
        `Auto-join channels for ${server.name}:`,
        autoJoinChannels.map((c) => c.name).join(', ')
      )

      for (const channel of autoJoinChannels) {
        try {
          await ircClient.joinChannel(server.id, channel.name)
          debugLog?.(`Auto-joined ${channel.name} on ${server.name}`)
        } catch (error) {
          debugLog?.(`Failed to auto-join ${channel.name}:`, error)
        }
      }
    } catch (error) {
      debugLog?.(`Failed to auto-connect to ${server.name}:`, error)
    }
  }
}
