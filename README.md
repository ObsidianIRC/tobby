# tobby

<img width="1429" height="797" alt="CopyQ NBYveQ" src="https://github.com/user-attachments/assets/d768019a-2f38-44df-b64c-60f892437ab0" />

**The Terminal Obby** — a keyboard-driven IRC client for the terminal.

## Install

```sh
npm install -g tobby

# or run without installing:
npx tobby

# or use without running
ssh h4ks.com

# In archlinux
yay -S tobby
# or
yay -S tobby-bin
```

> Requires [Bun](https://bun.sh/docs/installation) to be installed.

## Quickstart

```sh
tobby

# to see more options:
tobby --help
```

Press **Ctrl+K** to open the action menu. From there you can connect to a server and join channels.

Join a channel with `/join #channel` or open the action menu with `Ctrl+K` and select "Join channel". To send a message, just start typing. Press **Enter** to send, or **Shift+Enter** for a new line.

To react, reply hit `Ctrl+Space` to enter message selection mode, navigate to the message with arrows or `j`/`k`, and press `r` to reply or `e` to add reactions.

## Keyboard shortcuts

### General

| Key | Action |
|---|---|
| `Ctrl+K` | Open action menu (connect, join, disconnect, …) |
| `Ctrl+Space` | Enter message selection / scroll mode |
| `Ctrl+G` | Toggle members sidebar |
| `Ctrl+L` | Clear current buffer |
| `Ctrl+O` | Toggle multiline expand |
| `Ctrl+M` | Toggle multiline always-on |
| `Alt+[1-9]` | Switch to buffer by number |
| `Alt+N` / `Alt+P` | Next / previous buffer |
| `Tab` | Tab-complete nicks and commands |

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
- Typing notifications
- vim-like keybindings for navigation and message selection
- Multi-line support with collapsible messages
- Persistent config and chat history (SQLite)

## Development

```sh
git clone --recurse-submodules https://github.com/ObsidianIRC/tobby
cd tobby
# if you already cloned without --recurse-submodules:
git submodule update --init
bun install
bun run dev
```

Run tests and checks:

```sh
bun run lint:fix && bun run format && bun run test
```

Alternatively setup pre-commit hooks.

```sh
bun run prepare
```

Build distributable:

```sh
bun run build   # outputs dist/index.js

# install locally:
npm install -g .  # or npm link
```
