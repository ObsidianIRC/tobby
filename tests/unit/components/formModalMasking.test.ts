import { describe, it, expect } from 'vitest'
import { updateRealFromMasked } from '../../../src/utils/formMasking'

const MASK = '*'
const m = (n: number) => MASK.repeat(n)

describe('updateRealFromMasked', () => {
  it('typing first character', () => {
    expect(updateRealFromMasked('p', '')).toBe('p')
  })

  it('typing second character — previous is already masked', () => {
    expect(updateRealFromMasked(`${m(1)}a`, 'p')).toBe('pa')
  })

  it('typing multiple characters', () => {
    expect(updateRealFromMasked(`${m(3)}d`, 'pas')).toBe('pasd')
  })

  it('backspace at end removes last real char', () => {
    expect(updateRealFromMasked(m(3), 'pass')).toBe('pas')
  })

  it('delete all characters', () => {
    expect(updateRealFromMasked('', 'secret')).toBe('')
  })

  it('delete all but one', () => {
    expect(updateRealFromMasked(m(1), 'pass')).toBe('p')
  })

  it('paste a string into empty field', () => {
    expect(updateRealFromMasked('hello', '')).toBe('hello')
  })

  it('paste after existing content', () => {
    expect(updateRealFromMasked(`${m(3)}XY`, 'abc')).toBe('abcXY')
  })

  it('replace all via select-all + type', () => {
    expect(updateRealFromMasked('n', 'pass')).toBe('n')
  })

  it('feedback event: all mask chars same length as real value', () => {
    expect(updateRealFromMasked(m(4), 'pass')).toBe('pass')
  })

  it('empty display empty real is stable', () => {
    expect(updateRealFromMasked('', '')).toBe('')
  })
})
