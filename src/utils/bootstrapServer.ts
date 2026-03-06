import { v4 as uuidv4, v5 as uuidv5 } from 'uuid'
import { getDatabase } from '../services/database'
import type { Server, Channel } from '../types'

// Must match the namespace and formula used in ObsidianIRC/src/lib/ircClient.ts
const CHANNEL_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'

export function deterministicChannelId(serverId: string, channelName: string): string {
  return uuidv5(`${serverId}:${channelName}`, CHANNEL_NAMESPACE)
}

// Placeholder stored as saslPassword so the IRC client requests the `sasl` capability.
// The AUTHENTICATE handler detects the OAuth token and uses OAUTHBEARER instead,
// so this value is never sent to the server as an actual password.
const OAUTH_SASL_SENTINEL = '__oauth_bearer__'

interface CliServerArgs {
  host: string
  port: number
  nick: string
  ssl: boolean
  channels: string[]
}

export function bootstrapServer(args: CliServerArgs): void {
  const db = getDatabase()

  const existing = db.getAllServers().find((s) => s.host === args.host && s.port === args.port)

  if (existing) {
    // Server already in DB — only add channels that aren't there yet
    const persisted = db.getChannelsForServer(existing.id)
    for (const ch of args.channels) {
      const name = ch.startsWith('#') ? ch : `#${ch}`
      if (!persisted.find((c) => c.name === name)) {
        const id = deterministicChannelId(existing.id, name)
        db.saveChannel({ id, name, serverId: existing.id } as Channel, existing.id)
      }
    }
    return
  }

  const serverId = uuidv4()
  const server: Server = {
    id: serverId,
    name: args.host,
    host: args.host,
    port: args.port,
    ssl: args.ssl,
    nickname: args.nick,
    connectionState: 'disconnected',
    channels: [],
    privateChats: [],
    // When an OAuth token is present, populate saslUsername/saslPassword so the
    // IRC client includes `sasl` in CAP REQ. The actual AUTHENTICATE exchange
    // uses OAUTHBEARER — the placeholder password is never transmitted.
    ...(globalThis.__OAUTH_BEARER_TOKEN__
      ? { saslUsername: args.nick, saslPassword: OAUTH_SASL_SENTINEL }
      : {}),
  }
  db.saveServer(server)

  for (const ch of args.channels) {
    const name = ch.startsWith('#') ? ch : `#${ch}`
    db.saveChannel(
      { id: deterministicChannelId(serverId, name), name, serverId } as Channel,
      serverId
    )
  }
}
