# Installing tobby

## npx (no install needed)

```sh
npx @mattfillipe/tobby
```

## npm (global install)

```sh
npm install -g @mattfillipe/tobby
tobby
```

## Pre-built binaries

Grab the right binary from the [latest release](https://github.com/ObsidianIRC/tobby/releases/latest):

| File | Platform |
|------|----------|
| `tobby-x86_64-linux` | Linux x86_64 |
| `tobby-aarch64-linux` | Linux arm64 |
| `tobby-x86_64-macos` | macOS Intel |
| `tobby-aarch64-macos` | macOS Apple Silicon |
| `tobby-x86_64-windows.exe` | Windows x86_64 |

### Linux

```sh
chmod +x tobby-x86_64-linux
./tobby-x86_64-linux
```

### macOS

macOS quarantines binaries downloaded from the internet. Clear it once:

```sh
chmod +x tobby-aarch64-macos
xattr -dr com.apple.quarantine tobby-aarch64-macos
./tobby-aarch64-macos
```

### Windows

Double-click `tobby-x86_64-windows.exe` or run it from a terminal. Windows SmartScreen may warn about an unrecognized app — click **More info → Run anyway**. This happens because the binary isn't code-signed.

## Build from source

Requires [Bun](https://bun.sh).

```sh
git clone --recurse-submodules https://github.com/ObsidianIRC/tobby
cd tobby
bun install
bun run src/index.tsx
```
