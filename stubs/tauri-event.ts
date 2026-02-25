// Stub replacing @tauri-apps/api/event for non-Tauri builds.
// socket.ts from ObsidianIRC imports these but they are never called —
// our IRCClient override uses NodeTCPSocket and never calls createSocket().
export async function listen(
  _event: string,
  _handler: (event: unknown) => void
): Promise<() => void> {
  throw new Error('Tauri listen is not available in this environment')
}
