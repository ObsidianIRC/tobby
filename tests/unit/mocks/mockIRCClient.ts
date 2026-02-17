import { EventEmitter } from 'events'

export class MockIRCClient extends EventEmitter {
  public connected = false
  public servers = new Map()

  async connect(
    name: string,
    host: string,
    port: number,
    _nickname: string,
    _password?: string,
    _saslAccountName?: string,
    _saslPassword?: string,
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

  joinChannel(_serverId: string, channel: string) {
    return { id: 'mock-channel-id', name: channel }
  }
  leaveChannel(_serverId: string, _channel: string) {}
  sendMessage(_serverId: string, _channel: string, _message: string) {}
  sendRaw(_serverId: string, _command: string) {}
  sendWhisper(_serverId: string, _target: string, _channel: string, _content: string) {}
  sendTyping(_serverId: string, _target: string, _isActive: boolean) {}
}
