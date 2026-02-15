import { useState, useCallback } from 'react'
import type { User, Channel } from '../types'

interface UseTabCompletionOptions {
  users: User[]
  channels: Channel[]
}

export function useTabCompletion({ users, channels }: UseTabCompletionOptions) {
  const [completionIndex, setCompletionIndex] = useState(0)
  const [lastCompletion, setLastCompletion] = useState<string | null>(null)

  const getCompletions = useCallback(
    (prefix: string): string[] => {
      const lowerPrefix = prefix.toLowerCase()
      const completions: string[] = []

      if (prefix.startsWith('#')) {
        const channelNames = channels
          .map((c) => c.name)
          .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
        completions.push(...channelNames)
      } else if (prefix.startsWith('@')) {
        const usernames = users
          .map((u) => `@${u.nickname || u.username}`)
          .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
        completions.push(...usernames)
      } else {
        const usernames = users
          .map((u) => u.nickname || u.username)
          .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
        completions.push(...usernames)

        const channelNames = channels
          .map((c) => c.name)
          .filter((name) => name.toLowerCase().startsWith(lowerPrefix))
        completions.push(...channelNames)
      }

      return completions.sort()
    },
    [users, channels]
  )

  const complete = useCallback(
    (input: string, cursorPos: number): { value: string; cursorPos: number } | null => {
      const beforeCursor = input.slice(0, cursorPos)
      const afterCursor = input.slice(cursorPos)

      const words = beforeCursor.split(/\s+/)
      const currentWord = words[words.length - 1] || ''

      if (currentWord.length === 0) {
        return null
      }

      const completions = getCompletions(currentWord)

      if (completions.length === 0) {
        setLastCompletion(null)
        setCompletionIndex(0)
        return null
      }

      let index = completionIndex
      if (lastCompletion !== currentWord) {
        index = 0
        setCompletionIndex(0)
      }

      const completion = completions[index % completions.length]
      if (!completion) {
        return null
      }

      setLastCompletion(currentWord)
      setCompletionIndex((index + 1) % completions.length)

      const prefix = words.slice(0, -1).join(' ')
      const newValue = prefix + (prefix ? ' ' : '') + completion + afterCursor
      const newCursorPos = (prefix ? prefix.length + 1 : 0) + completion.length

      return { value: newValue, cursorPos: newCursorPos }
    },
    [completionIndex, lastCompletion, getCompletions]
  )

  const reset = useCallback(() => {
    setCompletionIndex(0)
    setLastCompletion(null)
  }, [])

  return { complete, reset }
}
