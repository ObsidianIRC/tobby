// Stub replacing @tauri-apps/api/core for non-Tauri builds.
// socket.ts from ObsidianIRC imports these but they are never called —
// our IRCClient override uses NodeTCPSocket and never calls createSocket().
export async function invoke(_cmd: string, _args?: unknown): Promise<unknown> {
  throw new Error('Tauri invoke is not available in this environment')
}
