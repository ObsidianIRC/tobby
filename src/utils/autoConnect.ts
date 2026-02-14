import { useStore } from '../store'
import type { IRCClient } from './ircClient'
import { getDatabase } from '../services/database'

export async function autoConnectServers(ircClient: IRCClient) {
  const { servers } = useStore.getState()

  for (const server of servers) {
    try {
      console.log(`Auto-connecting to ${server.name}...`)

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

      // Wait a bit for connection to establish
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Auto-join channels
      const db = getDatabase()
      const autoJoinChannels = db.getAutoJoinChannels(server.id)

      for (const channel of autoJoinChannels) {
        try {
          await ircClient.joinChannel(server.id, channel.name)
          console.log(`Auto-joined ${channel.name} on ${server.name}`)
        } catch (error) {
          console.error(`Failed to auto-join ${channel.name}:`, error)
        }
      }
    } catch (error) {
      console.error(`Failed to auto-connect to ${server.name}:`, error)
    }
  }
}
