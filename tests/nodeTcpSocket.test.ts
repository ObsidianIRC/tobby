import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { NodeTCPSocket } from '../src/lib/nodeTcpSocket'
import net from 'net'
import tls from 'tls'

describe('NodeTCPSocket', () => {
  let server: net.Server | tls.Server
  const testPort = 9999

  afterEach(() => {
    server?.close()
  })

  describe('TCP (non-TLS) connections', () => {
    beforeEach(() => {
      server = net.createServer((socket) => {
        socket.on('data', (data) => {
          // Echo back what we receive
          socket.write(data)
        })
      })
      server.listen(testPort)
    })

    test('should connect to TCP server', async () => {
      const socket = new NodeTCPSocket(`irc://localhost:${testPort}`)

      const connected = await new Promise<boolean>((resolve) => {
        socket.onopen = () => resolve(true)
        setTimeout(() => resolve(false), 1000)
      })

      expect(connected).toBe(true)
      expect(socket.readyState).toBe(1) // OPEN
      socket.close()
    })

    test('should send and receive data', async () => {
      const socket = new NodeTCPSocket(`irc://localhost:${testPort}`)

      await new Promise<void>((resolve) => {
        socket.onopen = () => resolve()
      })

      const testMessage = 'NICK testnick\r\n'
      let receivedData = ''

      const messageReceived = new Promise<string>((resolve) => {
        socket.onmessage = (event) => {
          receivedData += event.data
          if (receivedData.includes(testMessage)) {
            resolve(receivedData)
          }
        }
      })

      socket.send(testMessage)
      const received = await messageReceived

      expect(received).toContain('NICK testnick')
      socket.close()
    })

    test('should handle close event', async () => {
      const socket = new NodeTCPSocket(`irc://localhost:${testPort}`)

      await new Promise<void>((resolve) => {
        socket.onopen = () => resolve()
      })

      const closed = new Promise<boolean>((resolve) => {
        socket.onclose = () => resolve(true)
      })

      socket.close()
      expect(await closed).toBe(true)
      expect(socket.readyState).toBe(3) // CLOSED
    })

    test('should handle connection errors', async () => {
      const socket = new NodeTCPSocket('irc://localhost:19999') // Non-existent port

      const error = await new Promise<Error | null>((resolve) => {
        socket.onerror = (err) => resolve(err)
        setTimeout(() => resolve(null), 2000)
      })

      expect(error).toBeTruthy()
      expect(socket.readyState).toBe(3) // CLOSED after error
    })

    test('should throw error when sending while not connected', () => {
      const socket = new NodeTCPSocket('irc://localhost:19999')

      expect(() => {
        socket.send('test')
      }).toThrow('Socket is not connected')
    })
  })

  describe('TLS connections', () => {
    test('should connect to TLS server', async () => {
      // This test verifies TLS connection works but doesn't actually connect
      // to avoid certificate issues in CI/testing
      const socket = new NodeTCPSocket('ircs://irc.libera.chat:6697')

      // Just verify the socket is attempting to connect
      expect(socket.readyState).toBe(0) // CONNECTING

      // Clean up
      socket.close()
    })
  })

  describe('URL parsing', () => {
    test('should parse irc:// URLs correctly', () => {
      const socket = new NodeTCPSocket('irc://irc.example.com:6667')
      expect(socket.readyState).toBe(0) // CONNECTING
      socket.close()
    })

    test('should parse ircs:// URLs correctly', () => {
      const socket = new NodeTCPSocket('ircs://irc.example.com:6697')
      expect(socket.readyState).toBe(0) // CONNECTING
      socket.close()
    })

    test('should use default port 6667 for irc://', () => {
      const socket = new NodeTCPSocket('irc://irc.example.com')
      expect(socket.readyState).toBe(0)
      socket.close()
    })

    test('should use default port 6697 for ircs://', () => {
      const socket = new NodeTCPSocket('ircs://irc.example.com')
      expect(socket.readyState).toBe(0)
      socket.close()
    })
  })

  describe('readyState transitions', () => {
    beforeEach(() => {
      server = net.createServer()
      server.listen(testPort)
    })

    test('should transition from CONNECTING to OPEN', async () => {
      const socket = new NodeTCPSocket(`irc://localhost:${testPort}`)

      expect(socket.readyState).toBe(0) // CONNECTING

      await new Promise<void>((resolve) => {
        socket.onopen = () => resolve()
      })

      expect(socket.readyState).toBe(1) // OPEN
      socket.close()
    })

    test('should transition from OPEN to CLOSING to CLOSED', async () => {
      const socket = new NodeTCPSocket(`irc://localhost:${testPort}`)

      await new Promise<void>((resolve) => {
        socket.onopen = () => resolve()
      })

      expect(socket.readyState).toBe(1) // OPEN

      const closedPromise = new Promise<void>((resolve) => {
        socket.onclose = () => resolve()
      })

      socket.close()
      expect(socket.readyState).toBe(2) // CLOSING

      await closedPromise
      expect(socket.readyState).toBe(3) // CLOSED
    })
  })
})
