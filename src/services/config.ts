import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'
import type { AppConfig, ServerConfig } from '@/types/config'
import { DEFAULT_CONFIG } from '@/types/config'

const CONFIG_DIR = path.join(os.homedir(), '.config', 'obbytty')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')

class ConfigService {
  private config: AppConfig = DEFAULT_CONFIG
  private loaded = false

  async ensureConfigDir(): Promise<void> {
    try {
      await fs.mkdir(CONFIG_DIR, { recursive: true })
    } catch (error) {
      console.error('Failed to create config directory:', error)
    }
  }

  async load(): Promise<AppConfig> {
    if (this.loaded) {
      return this.config
    }

    await this.ensureConfigDir()

    try {
      const content = await fs.readFile(CONFIG_FILE, 'utf-8')
      const parsed = JSON.parse(content) as AppConfig
      this.config = { ...DEFAULT_CONFIG, ...parsed }
      this.loaded = true
    } catch {
      this.config = DEFAULT_CONFIG
      this.loaded = true
      await this.save()
    }

    return this.config
  }

  async save(): Promise<void> {
    await this.ensureConfigDir()

    try {
      await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8')
    } catch (error) {
      console.error('Failed to save config:', error)
    }
  }

  getConfig(): AppConfig {
    return this.config
  }

  async addServer(server: ServerConfig): Promise<void> {
    this.config.servers.push(server)
    await this.save()
  }

  async updateServer(serverId: string, updates: Partial<Omit<ServerConfig, 'id'>>): Promise<void> {
    const server = this.config.servers.find((s) => s.id === serverId)
    if (!server) return

    this.config.servers = this.config.servers.map((s) =>
      s.id === serverId
        ? {
            id: s.id,
            name: updates.name ?? s.name,
            host: updates.host ?? s.host,
            port: updates.port ?? s.port,
            ssl: updates.ssl ?? s.ssl,
            nickname: updates.nickname ?? s.nickname,
            realname: updates.realname ?? s.realname,
            username: updates.username ?? s.username,
            autoConnect: updates.autoConnect ?? s.autoConnect,
            autoJoin: updates.autoJoin ?? s.autoJoin,
            sasl: updates.sasl ?? s.sasl,
          }
        : s
    )
    await this.save()
  }

  async removeServer(serverId: string): Promise<void> {
    this.config.servers = this.config.servers.filter((s) => s.id !== serverId)
    await this.save()
  }

  getAutoConnectServers(): ServerConfig[] {
    return this.config.servers.filter((s) => s.autoConnect)
  }

  async setDefaultNick(nick: string): Promise<void> {
    this.config.defaultNick = nick
    await this.save()
  }
}

export const configService = new ConfigService()
