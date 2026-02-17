import { useTerminalDimensions } from '@opentui/react'
import { ServerPane } from './ServerPane'
import { ChatPane } from './ChatPane'
import { MemberPane } from './MemberPane'
import { StatusBar } from '../ui/StatusBar'
import { CommandInput } from '../ui/CommandInput'
import { TypingIndicator } from '../ui/TypingIndicator'
import { QuickActionsMenu } from '../modals/QuickActionsMenu'
import { ConnectServerModal } from '../modals/ConnectServerModal'
import { RemoveServerModal } from '../modals/RemoveServerModal'
import { useStore } from '../../store'
import { THEME } from '../../constants/theme'

export function MainLayout() {
  const { width, height } = useTerminalDimensions()
  const showUserPane = useStore((state) => state.showUserPane)
  const focusedPane = useStore((state) => state.focusedPane)
  const activeModal = useStore((state) => state.activeModal)

  const innerWidth = width - 2
  const serverPaneWidth = 25
  const memberPaneWidth = showUserPane ? 20 : 0
  const chatPaneWidth = innerWidth - serverPaneWidth - memberPaneWidth

  const commandInputHeight = 2
  const typingIndicatorHeight = 1
  const statusBarHeight = 1
  const contentHeight = height - 2 - commandInputHeight - typingIndicatorHeight - statusBarHeight

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

        <CommandInput width={innerWidth} />

        <StatusBar width={innerWidth} height={statusBarHeight} />
      </box>

      {activeModal === 'quickActions' && <QuickActionsMenu width={width} height={height} />}

      {activeModal === 'connect' && <ConnectServerModal width={width} height={height} />}

      {activeModal === 'removeServer' && <RemoveServerModal width={width} height={height} />}
    </box>
  )
}
