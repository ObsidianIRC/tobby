/**
 * End-to-end IRC connection test
 * Tests real connection to IRC server, joining a channel, and receiving messages
 */

import { test, expect } from 'vitest'
import { IRCClient } from '../src/utils/ircClient'

test('should connect to IRC server, join channel, and receive messages', async () => {
  const client = new IRCClient()
  const nickname = 'obbybot_' + Date.now()
  const serverId = 'irc.h4ks.com:6697'

  let connected = false
  let joinMessageReceived = false

  // Listen for connection state changes
  client.on('connectionStateChange', (data) => {
    console.log('[TEST] Connection state:', data.connectionState)
    if (data.connectionState === 'connected') {
      connected = true
    }
  })

  // Listen for all events and log them
  const eventTypes = ['JOIN', 'CHANMSG', 'PART', 'NICK', 'QUIT', 'MODE', 'NOTICE', 'PRIVMSG']
  eventTypes.forEach((eventType) => {
    client.on(eventType as any, (data: any) => {
      console.log(`[TEST] Event ${eventType}:`, JSON.stringify(data).substring(0, 200))
    })
  })

  try {
    // Connect to server
    console.log('[TEST] Connecting to irc.h4ks.com:6697 as', nickname)
    const connectionResult = await client.connect('irc.h4ks.com', 'irc.h4ks.com', 6697, nickname)

    expect(connectionResult).toBeDefined()
    expect(connectionResult.id).toBeDefined()

    // Wait for connection to establish
    console.log('[TEST] Waiting for connection...')
    await new Promise((resolve) => setTimeout(resolve, 3000))

    expect(connected).toBe(true)
    console.log('[TEST] ✅ Connected to IRC server')

    // Join #bots channel
    console.log('[TEST] Joining #bots channel...')
    const joinResult = await client.joinChannel(serverId, '#bots')

    expect(joinResult).toBeDefined()
    expect(joinResult.id).toBeDefined()

    // Wait for join to complete and check if we see the JOIN message
    console.log('[TEST] Waiting for channel join...')

    // Check if we received the JOIN message in the socket
    const socket = (client as any).sockets.get(serverId)
    if (socket) {
      const originalOnmessage = socket.onmessage
      socket.onmessage = (event: any) => {
        console.log('[TEST] Raw socket message:', event.data.substring(0, 150))
        if (event.data.includes('JOIN') && event.data.includes('#bots')) {
          joinMessageReceived = true
          console.log('[TEST] ✅ JOIN message received!')
        }
        if (originalOnmessage) originalOnmessage(event)
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 5000))

    expect(joinMessageReceived).toBe(true)
    console.log('[TEST] ✅ JOIN message received from IRC server')

    // Get channel list to verify we're in it
    const server = (client as any).servers.get(serverId)
    expect(server).toBeDefined()
    expect(server.channels).toBeDefined()
    expect(server.channels.length).toBeGreaterThan(0)

    const botsChannel = server.channels.find((c: any) => c.id === '#bots' || c.name === '#bots')
    expect(botsChannel).toBeDefined()
    console.log('[TEST] ✅ #bots channel found in server channel list')

    console.log('[TEST] All assertions passed! ✅')
  } catch (err) {
    console.error('[TEST] ❌ Test failed:', err)
    throw err
  } finally {
    // Cleanup: disconnect and remove server from internal state
    try {
      console.log('[TEST] Disconnecting...')
      client.disconnect(serverId)
      // Remove server from internal maps so no lingering state
      ;(client as any).servers.delete(serverId)
      ;(client as any).sockets.delete(serverId)
      ;(client as any).nicks.delete(serverId)
      ;(client as any).currentUsers?.delete(serverId)
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (e) {
      console.error('[TEST] Error during cleanup:', e)
    }
  }
}, 30000) // 30 second timeout
