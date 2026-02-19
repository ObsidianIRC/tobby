import { useTerminalDimensions } from '@opentui/react'
import { ServerPane } from './ServerPane'
import { ChatPane } from './ChatPane'
import { MemberPane } from './MemberPane'
import { StatusBar } from '../ui/StatusBar'
import { CommandInput } from '../ui/CommandInput'
import { TypingIndicator } from '../ui/TypingIndicator'
import { ReplyBar } from '../ui/ReplyBar'
import { QuickActionsMenu } from '../modals/QuickActionsMenu'
import { ConnectServerModal } from '../modals/ConnectServerModal'
import { RemoveServerModal } from '../modals/RemoveServerModal'
import { EmojiPickerModal } from '../modals/EmojiPickerModal'
import { SetTopicModal } from '../modals/SetTopicModal'
import { ChannelBrowserModal } from '../modals/ChannelBrowserModal'
import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { THEME } from '../../constants/theme'

export function MainLayout() {
  const { width, height } = useTerminalDimensions()
  const showUserPane = useStore((state) => state.showUserPane)
  const focusedPane = useStore((state) => state.focusedPane)
  const activeModal = useStore((state) => state.activeModal)
  const replyingTo = useStore((state) => state.replyingTo)
  const quitWarning = useStore((state) => state.quitWarning)
  const inputLineCount = useStore((state) => state.inputLineCount)
  const selectedMessage = useStore((state) => state.selectedMessage)
  const setSelectedMessage = useStore((state) => state.setSelectedMessage)
  const closeModal = useStore((state) => state.closeModal)
  const updateMessage = useStore((state) => state.updateMessage)
  const currentServerId = useStore((state) => state.currentServerId)
  const currentChannelId = useStore((state) => state.currentChannelId)
  const servers = useStore((state) => state.servers)
  const { ircClient } = useAppContext()

  const currentServer = servers.find((s) => s.id === currentServerId)

  const innerWidth = width - 2
  const serverPaneWidth = 25
  const memberPaneWidth = showUserPane ? 20 : 0
  const chatPaneWidth = innerWidth - serverPaneWidth - memberPaneWidth

  const commandInputHeight = 2 + Math.min(inputLineCount, 5) + (quitWarning ? 1 : 0)
  const typingIndicatorHeight = 1
  const statusBarHeight = 1
  const replyBarHeight = replyingTo ? 2 : 0
  const contentHeight =
    height - 2 - commandInputHeight - typingIndicatorHeight - replyBarHeight - statusBarHeight

  const handleEmojiSelect = (emoji: string) => {
    if (!selectedMessage || !currentServer || !currentChannelId || !ircClient) {
      closeModal()
      setSelectedMessage(null)
      return
    }

    const myNick = currentServer.nickname
    const existing = selectedMessage.reactions
    const alreadyReacted = existing.some((r) => r.emoji === emoji && r.userId === myNick)

    if (selectedMessage.msgid) {
      const currentChannel = currentServer.channels.find((c) => c.id === currentChannelId)
      const target = currentChannel?.name ?? currentChannelId
      const tag = alreadyReacted
        ? `+draft/unreact=${emoji};+draft/reply=${selectedMessage.msgid}`
        : `+draft/react=${emoji};+draft/reply=${selectedMessage.msgid}`
      ircClient.sendRaw(currentServer.id, `@${tag} TAGMSG ${target}`)
    } else {
      // No msgid — server can't echo it back, so apply locally
      const newReactions = alreadyReacted
        ? existing.filter((r) => !(r.emoji === emoji && r.userId === myNick))
        : [...existing, { emoji, userId: myNick }]
      updateMessage(currentChannelId, selectedMessage.id, { reactions: newReactions })
    }

    closeModal()
    setSelectedMessage(null)
  }

  return (
    <box width={width} height={height} flexDirection="column">
      <box
        width={width}
        height={height}
        border
        borderStyle="single"
        borderColor={THEME.border}
        flexDirection="column"
      >
        <box flexDirection="row" height={contentHeight}>
          <ServerPane
            width={serverPaneWidth}
            height={contentHeight}
            focused={focusedPane === 'servers'}
          />

          <ChatPane width={chatPaneWidth} height={contentHeight} focused={focusedPane === 'chat'} />

          {showUserPane && (
            <MemberPane
              width={memberPaneWidth}
              height={contentHeight}
              focused={focusedPane === 'users'}
            />
          )}
        </box>

        <TypingIndicator width={innerWidth} />

        {replyingTo && <ReplyBar width={innerWidth} />}

        <CommandInput width={innerWidth} />

        <StatusBar width={innerWidth} height={statusBarHeight} />
      </box>

      {activeModal === 'quickActions' && <QuickActionsMenu width={width} height={height} />}

      {activeModal === 'connect' && <ConnectServerModal width={width} height={height} />}

      {activeModal === 'removeServer' && <RemoveServerModal width={width} height={height} />}

      {activeModal === 'emojiPicker' && (
        <EmojiPickerModal width={width} height={height} onEmojiSelect={handleEmojiSelect} />
      )}

      {activeModal === 'set-topic' && <SetTopicModal width={width} height={height} />}

      {activeModal === 'channel-browser' && <ChannelBrowserModal width={width} height={height} />}
    </box>
  )
}
