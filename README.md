# ObbyTTY - Modern IRC Terminal Client

A fully-featured IRC client for the terminal built with OpenTUI, TypeScript, and ObsidianIRC.

## Features

- **Vi-mode Support** - NORMAL/INSERT modes throughout
- **Three-Pane Layout** - Servers | Chat | Members
- **Action System** - 19 actions with fuzzy search
- **Tab Completion** - Username and channel completion
- **Typing Indicators** - Real-time typing status
- **Quick Actions** - Ctrl+K fuzzy finder
- **Multiple Servers** - Connect to multiple IRC servers
- **SASL Authentication** - Secure login support
- **Message Threading** - Reply to messages
- **User Modes** - Visual indicators (@%+~&)
- **Away Status** - Shows away users
- **Unread Counts** - Visual indicators for unread messages
- **Mention Highlights** - Red indicators for mentions

## Installation

```bash
bun install
```

## Usage

Start the application:

```bash
bun run dev
```

## Keyboard Shortcuts

### Modes
- `i` - Enter INSERT mode
- `Esc` - Enter NORMAL mode

### Navigation
- `1` - Focus servers pane
- `2` - Focus chat pane
- `3` - Focus members pane
- `Ctrl+H` - Toggle server pane
- `Ctrl+L` - Toggle member pane
- `Ctrl+N` - Next channel
- `Ctrl+P` - Previous channel

### Actions
- `Ctrl+K` - Open quick actions menu
- `Enter` - Send message (INSERT mode)
- `Tab` - Tab completion (INSERT mode)

### Quit
- `Shift+Q` - Quit application
- `Ctrl+Esc` - Force quit

## Getting Started

1. Press `Ctrl+K` to open the quick actions menu
2. Type "connect" and select "Connect to Server"
3. Fill in your IRC server details:
   - Name: A friendly name for the server
   - Host: IRC server address (e.g., irc.libera.chat)
   - Port: Usually 6667 (plain) or 6697 (SSL)
   - Nickname: Your IRC nickname
   - Optional: SASL username/password for authentication
4. After connecting, use `Ctrl+K` again and type "join" to join a channel
5. Start chatting!

## Available Actions

### Server Actions (5)
- `server.connect` - Connect to server
- `server.connectWith` - Connect with custom settings
- `server.disconnect` - Disconnect from server
- `server.reconnect` - Reconnect to server
- `server.remove` - Remove server

### Channel Actions (7)
- `channel.join` - Join channel
- `channel.part` - Leave channel
- `channel.topic.get` - Get channel topic
- `channel.topic.set` - Set channel topic
- `channel.next` - Next channel (Ctrl+N)
- `channel.prev` - Previous channel (Ctrl+P)
- `channel.markAsRead` - Mark as read

### Message Actions (7)
- `message.send` - Send message (Enter)
- `message.sendMultiline` - Send multiline message
- `message.reply` - Reply to message
- `message.edit` - Edit message
- `message.delete` - Delete message
- `message.react` - React with emoji
- `message.typing` - Send typing indicator

## Architecture

### Technology Stack
- **OpenTUI (React)** - Terminal UI framework
- **TypeScript** - Type-safe development
- **Zustand** - State management
- **Bun** - JavaScript runtime and package manager
- **ObsidianIRC** - IRC protocol implementation

### Project Structure
```
src/
├── actions/          # Action system (19 actions)
├── components/       # UI components
│   ├── layout/      # Main layout components
│   ├── modals/      # Modal components
│   └── ui/          # Reusable UI components
├── context/         # React context providers
├── hooks/           # Custom React hooks
├── store/           # Zustand store + slices
├── types/           # TypeScript type definitions
└── utils/           # Utility functions
```

### State Management
The application uses Zustand with 5 slices:
- **serversSlice** - Server/channel CRUD operations
- **messagesSlice** - Message storage and retrieval
- **uiSlice** - UI state (focused pane, modals, vi-mode)
- **settingsSlice** - User settings
- **ircSlice** - IRC event handling and client lifecycle

## Development

### Run Tests
```bash
# Run unit and integration tests
bun test tests/unit/ tests/integration/

# Run all tests (includes ObsidianIRC)
bun test
```

### Type Checking
```bash
bun typecheck
```

### Linting
```bash
bun lint          # Check code style
bun lint:fix      # Fix linting issues
```

### Code Formatting
```bash
bun format        # Format with Prettier
```

## Testing

The project has **28 passing tests** (100% success rate):
- **17 unit tests** - Action registry functionality
- **11 integration tests** - IRC flow and store operations

## Configuration

Configuration options can be found in:
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts
- `vitest.config.ts` - Test configuration
- `eslint.config.js` - Linting rules

## Contributing

This is a personal project, but contributions are welcome! Please ensure:
1. No `any` types - Maintain strict type safety
2. No `!` operator - Use proper null checking
3. All features tested - Add tests for new functionality
4. Follow existing patterns - Consistent code style

## License

MIT

## Acknowledgments

- Built with [OpenTUI](https://github.com/opentui/opentui) - Terminal UI framework
- IRC protocol implementation by [ObsidianIRC](https://github.com/your-username/ObsidianIRC)
- State management by [Zustand](https://github.com/pmndrs/zustand)
- Runtime powered by [Bun](https://bun.sh)
