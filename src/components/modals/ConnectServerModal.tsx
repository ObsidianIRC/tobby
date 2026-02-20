import { useStore } from '../../store'
import { useAppContext } from '../../context/AppContext'
import { FormModal } from './FormModal'
import type { FormField } from './FormModal'

interface ConnectServerModalProps {
  width: number
  height: number
}

export function ConnectServerModal({ width, height }: ConnectServerModalProps) {
  const { registry, ircClient, renderer } = useAppContext()
  const store = useStore()
  const closeModal = useStore((state) => state.closeModal)

  // Prefill from --setup CLI args if present
  const prefill = globalThis.__CLI_PREFILL__
  const defaultPort = String(prefill?.port ?? 6697)
  const fields: FormField[] = [
    { key: 'name', label: 'Server Name', placeholder: 'My Server', defaultValue: prefill?.host },
    {
      key: 'host',
      label: 'Host',
      placeholder: 'irc.example.com',
      defaultValue: prefill?.host,
    },
    { key: 'port', label: 'Port', placeholder: '6697', defaultValue: defaultPort },
    { key: 'nickname', label: 'Nickname', placeholder: 'username', defaultValue: prefill?.nick },
    { key: 'password', label: 'Password', placeholder: '(optional)', secret: true },
    { key: 'saslUsername', label: 'SASL Username', placeholder: '(optional)' },
    { key: 'saslPassword', label: 'SASL Password', placeholder: '(optional)', secret: true },
  ]

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
      channels: globalThis.__CLI_PREFILL__?.channels,
    }

    registry.execute('server.connectWith', context, params)
    closeModal()
  }

  return (
    <FormModal
      width={width}
      height={height}
      title="Add Server"
      fields={fields}
      onSubmit={handleSubmit}
      onCancel={closeModal}
      submitLabel="Connect"
    />
  )
}
