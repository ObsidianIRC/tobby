import { describe, it, expect, beforeEach } from 'vitest'
import {
  setRestrictions,
  getRestrictions,
  checkServerRestriction,
  checkNickRestriction,
} from '@/utils/restrictions'

beforeEach(() => setRestrictions({}))

// ---------------------------------------------------------------------------
// setRestrictions / getRestrictions
// ---------------------------------------------------------------------------

describe('setRestrictions / getRestrictions', () => {
  it('starts with no restrictions after reset', () => {
    expect(getRestrictions()).toEqual({})
  })

  it('stores server and nick restrictions', () => {
    setRestrictions({ server: 'irc.libera.chat', nick: 'alice' })
    expect(getRestrictions().server).toBe('irc.libera.chat')
    expect(getRestrictions().nick).toBe('alice')
  })

  it('overwrites previous restrictions', () => {
    setRestrictions({ server: 'irc.libera.chat', nick: 'alice' })
    setRestrictions({ nick: 'bob' })
    expect(getRestrictions().server).toBeUndefined()
    expect(getRestrictions().nick).toBe('bob')
  })
})

// ---------------------------------------------------------------------------
// checkServerRestriction
// ---------------------------------------------------------------------------

describe('checkServerRestriction', () => {
  it('returns null when no restriction is set', () => {
    expect(checkServerRestriction('irc.anything.com')).toBeNull()
  })

  it('returns null for the exact allowed host', () => {
    setRestrictions({ server: 'irc.libera.chat' })
    expect(checkServerRestriction('irc.libera.chat')).toBeNull()
  })

  it('is case-insensitive', () => {
    setRestrictions({ server: 'irc.libera.chat' })
    expect(checkServerRestriction('IRC.LIBERA.CHAT')).toBeNull()
    expect(checkServerRestriction('Irc.Libera.Chat')).toBeNull()
  })

  it('returns an error message for a different host', () => {
    setRestrictions({ server: 'irc.libera.chat' })
    const err = checkServerRestriction('irc.freenode.net')
    expect(err).not.toBeNull()
    expect(err).toMatch(/restricted/i)
  })

  it('error message includes the allowed server name', () => {
    setRestrictions({ server: 'irc.libera.chat' })
    const err = checkServerRestriction('other.com')
    expect(err).toContain('irc.libera.chat')
  })

  it('does not allow a subdomain when exact host is restricted', () => {
    setRestrictions({ server: 'libera.chat' })
    const err = checkServerRestriction('irc.libera.chat')
    expect(err).not.toBeNull()
  })

  it('returns null when nick restriction is set but not server', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkServerRestriction('irc.anything.com')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// checkNickRestriction
// ---------------------------------------------------------------------------

describe('checkNickRestriction', () => {
  it('returns null when no restriction is set', () => {
    expect(checkNickRestriction('anyone')).toBeNull()
  })

  it('returns null for the exact allowed nick', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkNickRestriction('alice')).toBeNull()
  })

  it('is case-insensitive', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkNickRestriction('Alice')).toBeNull()
    expect(checkNickRestriction('ALICE')).toBeNull()
  })

  it('allows one trailing underscore (server collision suffix)', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkNickRestriction('alice_')).toBeNull()
  })

  it('allows multiple trailing underscores', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkNickRestriction('alice__')).toBeNull()
    expect(checkNickRestriction('alice___')).toBeNull()
  })

  it('returns an error for a completely different nick', () => {
    setRestrictions({ nick: 'alice' })
    const err = checkNickRestriction('bob')
    expect(err).not.toBeNull()
    expect(err).toMatch(/restricted/i)
  })

  it('error message includes the allowed nick', () => {
    setRestrictions({ nick: 'alice' })
    const err = checkNickRestriction('bob')
    expect(err).toContain('alice')
  })

  it('does not allow a nick that merely starts with the restricted nick', () => {
    setRestrictions({ nick: 'alice' })
    expect(checkNickRestriction('alice2')).not.toBeNull()
    expect(checkNickRestriction('alicebot')).not.toBeNull()
  })

  it('handles restricted nick that itself has trailing underscores', () => {
    setRestrictions({ nick: 'alice_' })
    expect(checkNickRestriction('alice')).toBeNull()
    expect(checkNickRestriction('alice_')).toBeNull()
    expect(checkNickRestriction('alice__')).toBeNull()
  })

  it('returns null when server restriction is set but not nick', () => {
    setRestrictions({ server: 'irc.libera.chat' })
    expect(checkNickRestriction('anyone')).toBeNull()
  })
})
