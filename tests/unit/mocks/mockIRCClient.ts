import { EventEmitter } from 'events'
import type { IRCClient } from '@/utils/ircClient'

export class MockIRCClient extends EventEmitter {
  public connected = false
  public servers = new Map()

  async connect(
    name: string,
    host: string,
    port: number,
    nickname: string,
    password?: string,
    saslAccountName?: string,
    saslPassword?: string,
    serverId?: string
  ) {
    this.connected = true
    this.servers.set(serverId || 'mock-id', {
      id: serverId || 'mock-id',
      name,
      host,
      port,
      isConnected: true,
    })
    return Promise.resolve({ id: serverId || 'mock-id' })
  }

  disconnect(serverId: string) {
    this.connected = false
    this.servers.delete(serverId)
  }

  // Add other methods as needed for tests, mostly no-ops or spies
  joinChannel(serverId: string, channel: string) {
    return { id: 'mock-channel-id', name: channel }
  }
  leaveChannel(serverId: string, channel: string) {}
  sendMessage(serverId: string, channel: string, message: string) {}
  sendRaw(serverId: string, command: string) {}
}
