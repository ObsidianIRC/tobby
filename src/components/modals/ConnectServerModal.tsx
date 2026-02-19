import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { FormModal } from './FormModal'
import type { FormField } from './FormModal'

interface ConnectServerModalProps {
  width: number
  height: number
}

const FIELDS: FormField[] = [
  { key: 'name', label: 'Server Name', placeholder: 'My Server' },
  { key: 'host', label: 'Host', placeholder: 'irc.example.com' },
  { key: 'port', label: 'Port', placeholder: '6697', defaultValue: '6697' },
  { key: 'nickname', label: 'Nickname', placeholder: 'username' },
  { key: 'password', label: 'Password', placeholder: '(optional)', secret: true },
  { key: 'saslUsername', label: 'SASL Username', placeholder: '(optional)' },
  { key: 'saslPassword', label: 'SASL Password', placeholder: '(optional)', secret: true },
]

export function ConnectServerModal({ width, height }: ConnectServerModalProps) {
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const closeModal = useStore((state) => state.closeModal)

  const handleSubmit = (values: Record<string, string>) => {
    if (!values.name || !values.host || !values.nickname || !ircClient) return

    const context = { store, ircClient, renderer }
    const params = {
      name: values.name,
      host: values.host,
      port: parseInt(values.port ?? '6697', 10) || 6697,
      nickname: values.nickname,
      password: values.password || undefined,
      saslUsername: values.saslUsername || undefined,
      saslPassword: values.saslPassword || undefined,
    }

    registry.execute('server.connectWith', context, params)
    closeModal()
  }

  return (
    <FormModal
      width={width}
      height={height}
      title="Add Server"
      fields={FIELDS}
      onSubmit={handleSubmit}
      onCancel={closeModal}
      submitLabel="Connect"
    />
  )
}
