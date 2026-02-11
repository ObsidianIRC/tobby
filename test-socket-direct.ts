/**
 * Direct test of IRC connection using our NodeTCPSocket
 */

import { NodeTCPSocket } from './src/lib/nodeTcpSocket'

console.log('Testing IRC connection with NodeTCPSocket...')

// Test with a public IRC server
const socket = new NodeTCPSocket('irc://irc.libera.chat:6667')

socket.onopen = () => {
  console.log('✅ Socket opened successfully!')
  console.log('Sending NICK and USER commands...')
  socket.send('NICK testbot123')
  socket.send('USER testbot 0 * :Test Bot')
}

socket.onmessage = (event) => {
  const data = event.data.trim()
  if (!data) return

  console.log('📨 Raw:', JSON.stringify(data))

  const lines = data.split(/\r?\n/)

  for (const line of lines) {
    if (!line) continue
    console.log('📨 Line:', line)

    // Respond to PING
    if (line.startsWith('PING')) {
      const server = line.split(' ')[1]
      console.log('Responding to PING with', server)
      socket.send(`PONG ${server}`)
    }

    // Check for successful registration (001, 002, 003, 004, or 376)
    const match = line.match(/:(\S+)\s+(\d{3})\s+/)
    if (match) {
      const numeric = match[2]
      console.log(`Got numeric: ${numeric}`)

      if (['001', '002', '003', '004', '376'].includes(numeric)) {
        console.log('✅ Successfully connected to IRC server!')
        console.log('Sending QUIT...')
        socket.send('QUIT :Test complete')
        setTimeout(() => {
          console.log('✅ Test passed!')
          process.exit(0)
        }, 500)
        return
      }
    }
  }
}

socket.onerror = (error) => {
  console.error('❌ Socket error:', error)
  process.exit(1)
}

socket.onclose = () => {
  console.log('Socket closed')
}

// Timeout after 15 seconds
setTimeout(() => {
  console.error('❌ Test timed out')
  process.exit(1)
}, 15000)
