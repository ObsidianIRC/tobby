# tobby

**The Terminal Obby** — a keyboard-driven IRC client for the terminal.

## Install

```sh
npm install -g tobby
# or run without installing:
npx tobby
```

> Requires [Bun](https://bun.sh/docs/installation) to be installed.

## Quickstart

```sh
tobby
```

Press **Ctrl+K** to open the action menu. From there you can connect to a server and join channels.

## Keyboard shortcuts

### General

| Key | Action |
|---|---|
| `Ctrl+K` | Open action menu (connect, join, disconnect, …) |
| `Ctrl+Space` | Enter message selection / scroll mode |
| `Alt+[1-9]` | Switch to buffer by number |
| `Tab` | Tab-complete nicks and commands |
| `Ctrl+M` | Toggle multiline input |

### Message selection mode (`Ctrl+Space`)

| Key | Action |
|---|---|
| `j` / `k` | Move down / up |
| `g` / `G` | Jump to top / bottom |
| `y` | Yank (copy) selected message |
| `r` | Reply to selected message |
| `R` | Add emoji reaction |
| `Esc` | Exit selection mode |

### Multiline input

| Key | Action |
|---|---|
| `Enter` | New line |
| `Ctrl+Enter` | Send message |

## Features

- **IRCv3**: multiline messages, emoji reactions, edit/delete, replies, SASL PLAIN/EXTERNAL, `echo-message`, `chathistory`
- Three-pane layout: server tree · message buffer · user list
- Channel browser (`/list`)
- Nick tab completion with fuzzy emoji picker for reactions
- Typing indicators
- Persistent config and chat history (SQLite)

## Development

```sh
git clone --recurse-submodules https://github.com/your-username/tobby
cd tobby
# if you already cloned without --recurse-submodules:
git submodule update --init
bun install
bun run dev
```

Run tests:

```sh
bun run test
```

Build distributable:

```sh
bun run build   # outputs dist/index.js
```

## License

MIT
