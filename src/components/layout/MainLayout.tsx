import { useTerminalDimensions } from '@opentui/react'
import { ServerPane } from './ServerPane'
import { ChatPane } from './ChatPane'
import { MemberPane } from './MemberPane'
import { StatusBar } from '../ui/StatusBar'
import { CommandInput } from '../ui/CommandInput'
import { QuickActionsMenu } from '../modals/QuickActionsMenu'
import { ConnectServerModal } from '../modals/ConnectServerModal'
import { useStore } from '../../store'

export function MainLayout() {
  const { width, height } = useTerminalDimensions()
  const showUserPane = useStore((state) => state.showUserPane)
  const focusedPane = useStore((state) => state.focusedPane)
  const activeModal = useStore((state) => state.activeModal)

  const serverPaneWidth = 25
  const memberPaneWidth = showUserPane ? 20 : 0
  const chatPaneWidth = width - serverPaneWidth - memberPaneWidth

  const commandInputHeight = 3
  const statusBarHeight = 1
  const contentHeight = height - commandInputHeight - statusBarHeight

  return (
    <box flexDirection="column" width={width} height={height}>
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

      <CommandInput width={width} />

      <StatusBar width={width} height={statusBarHeight} />

      {activeModal === 'quickActions' && <QuickActionsMenu width={width} height={height} />}

      {activeModal === 'connect' && <ConnectServerModal width={width} height={height} />}
    </box>
  )
}
