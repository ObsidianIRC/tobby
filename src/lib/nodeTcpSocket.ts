import net from 'net'
import tls from 'tls'

interface ISocket {
  onopen: (() => void) | null
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((error: Error) => void) | null
  onclose: (() => void) | null

  send(data: string): void
  close(): void
  readyState: number
}

export class NodeTCPSocket implements ISocket {
  private socket: net.Socket | tls.TLSSocket
  private _readyState = 0

  public onopen: (() => void) | null = null
  public onmessage: ((event: { data: string }) => void) | null = null
  public onerror: ((error: Error) => void) | null = null
  public onclose: (() => void) | null = null

  constructor(url: string) {
    const parsed = new URL(url)
    const host = parsed.hostname
    const port = Number(parsed.port) || (parsed.protocol === 'ircs:' ? 6697 : 6667)
    const useTLS = parsed.protocol === 'ircs:'

    this._readyState = 0

    if (useTLS) {
      this.socket = tls.connect({
        host,
        port,
        rejectUnauthorized: false,
      })
      // For TLS, wait for handshake to complete before signaling open
      ;(this.socket as tls.TLSSocket).on('secureConnect', () => {
        if (this._readyState === 0) {
          this._readyState = 1
          this.onopen?.()
        }
      })
    } else {
      this.socket = net.connect({ host, port })
      this.socket.on('connect', () => {
        this._readyState = 1
        this.onopen?.()
      })
    }

    this.socket.on('data', (data: Buffer) => {
      const text = data.toString('utf-8')
      globalThis.debugLog?.(`[Socket] data from ${host}: ${text.substring(0, 500)}`)
      this.onmessage?.({ data: text })
    })

    this.socket.on('error', (err: Error) => {
      this._readyState = 3
      this.onerror?.(err)
    })

    this.socket.on('close', () => {
      this._readyState = 3
      this.onclose?.()
    })

    this.socket.on('end', () => {
      this._readyState = 3
      this.onclose?.()
    })
  }

  get readyState(): number {
    return this._readyState
  }

  send(data: string): void {
    if (this._readyState !== 1) {
      throw new Error('Socket is not connected')
    }
    // IRC protocol requires \r\n at the end of each message
    if (!data.endsWith('\r\n')) {
      data = data + '\r\n'
    }
    this.socket.write(data)
  }

  close(): void {
    if (this._readyState === 1) {
      this._readyState = 2
      this.socket.end()
    }
  }
}
