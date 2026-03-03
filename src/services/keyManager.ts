import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'node:crypto'

const SERVICE = 'tobby'
const ACCOUNT = 'enc-key'
const PREFIX = '$tobby1$'
// Fixed domain-separation salt — passphrase entropy is the real secret
const KDF_SALT = Buffer.from('tobby-enc-salt-v1', 'utf8')
const KDF_ITER = 600_000
const KDF_LEN = 32

class KeyManager {
  private static instance: KeyManager
  private key: Buffer | null = null
  private warning: string | null = null

  static getInstance(): KeyManager {
    if (!KeyManager.instance) KeyManager.instance = new KeyManager()
    return KeyManager.instance
  }

  async initialize(stdinPassphrase?: string): Promise<void> {
    const passphrase = stdinPassphrase ?? (await this.getOsPassphrase())
    if (!passphrase) {
      this.warning =
        'No encryption key available — passwords stored unencrypted. Use --stdin-enc-key or set up a system keyring (libsecret-tools on Linux, Keychain on macOS).'
      return
    }
    this.key = pbkdf2Sync(passphrase, KDF_SALT, KDF_ITER, KDF_LEN, 'sha256')
  }

  isAvailable(): boolean {
    return this.key !== null
  }

  getWarning(): string | null {
    return this.warning
  }

  encrypt(plaintext: string): string {
    if (!this.key) return plaintext
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', this.key, iv)
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return `${PREFIX}${iv.toString('hex')}:${enc.toString('hex')}:${tag.toString('hex')}`
  }

  decrypt(value: string): string {
    // Passthrough: key not available or value is plaintext (backwards compat)
    if (!this.key || !value.startsWith(PREFIX)) return value
    const [ivHex, dataHex, tagHex] = value.slice(PREFIX.length).split(':')
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivHex!, 'hex'))
    decipher.setAuthTag(Buffer.from(tagHex!, 'hex'))
    return decipher.update(Buffer.from(dataHex!, 'hex')) + decipher.final('utf8')
  }

  private async getOsPassphrase(): Promise<string | null> {
    if (process.platform === 'darwin') return this.macosKeychain()
    if (process.platform === 'linux') return this.linuxSecretTool()
    // Windows: no keyring support
    return null
  }

  private macosKeychain(): string | null {
    const get = Bun.spawnSync([
      'security',
      'find-generic-password',
      '-s',
      SERVICE,
      '-a',
      ACCOUNT,
      '-w',
    ])
    if (get.exitCode === 0) return get.stdout.toString().trim()
    // First run: generate + store (macOS shows Keychain auth dialog automatically)
    const passphrase = randomBytes(32).toString('hex')
    const set = Bun.spawnSync([
      'security',
      'add-generic-password',
      '-U',
      '-s',
      SERVICE,
      '-a',
      ACCOUNT,
      '-w',
      passphrase,
    ])
    return set.exitCode === 0 ? passphrase : null
  }

  private linuxSecretTool(): string | null {
    // Requires libsecret-tools; gracefully returns null if not installed or daemon not running
    const get = Bun.spawnSync(['secret-tool', 'lookup', 'service', SERVICE, 'account', ACCOUNT])
    if (get.exitCode === 0) return get.stdout.toString().trim()
    const passphrase = randomBytes(32).toString('hex')
    const set = Bun.spawnSync(
      [
        'secret-tool',
        'store',
        '--label',
        'tobby encryption key',
        'service',
        SERVICE,
        'account',
        ACCOUNT,
      ],
      { stdin: Buffer.from(passphrase, 'utf8') }
    )
    return set.exitCode === 0 ? passphrase : null
  }
}

export const keyManager = KeyManager.getInstance()
