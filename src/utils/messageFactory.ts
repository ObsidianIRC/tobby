import { v4 as uuidv4 } from 'uuid'
import type { Message } from '@/types'

export function createMessage(
  type: Message['type'],
  content: string,
  userId: string,
  channelId: string,
  serverId: string,
  overrides?: Partial<Message>
): Message {
  return {
    id: uuidv4(),
    type,
    content,
    timestamp: new Date(),
    userId,
    channelId,
    serverId,
    reactions: [],
    replyMessage: null,
    mentioned: [],
    ...overrides,
  }
}
