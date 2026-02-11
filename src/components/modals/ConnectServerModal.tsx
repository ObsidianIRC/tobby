import { useState } from "react";
import { useKeyboard } from "@opentui/react";
import { useStore } from "../../store";
import { useAppContext } from "../../context/AppContext";

interface ConnectServerModalProps {
  width: number;
  height: number;
}

export function ConnectServerModal({ width, height }: ConnectServerModalProps) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("6667");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [saslUsername, setSaslUsername] = useState("");
  const [saslPassword, setSaslPassword] = useState("");
  const [focusedField, setFocusedField] = useState(0);

  const { registry, ircClient, renderer } = useAppContext();
  const store = useStore();
  const closeModal = useStore((state) => state.closeModal);

  const fields = [
    { label: "Server Name", value: name, setValue: setName, placeholder: "My Server" },
    { label: "Host", value: host, setValue: setHost, placeholder: "irc.example.com" },
    { label: "Port", value: port, setValue: setPort, placeholder: "6667" },
    { label: "Nickname", value: nickname, setValue: setNickname, placeholder: "username" },
    { label: "Password", value: password, setValue: setPassword, placeholder: "(optional)" },
    { label: "SASL Username", value: saslUsername, setValue: setSaslUsername, placeholder: "(optional)" },
    { label: "SASL Password", value: saslPassword, setValue: setSaslPassword, placeholder: "(optional)" },
  ];

  useKeyboard((key) => {
    if (key.name === "escape") {
      closeModal();
      return;
    }

    if (key.name === "tab") {
      setFocusedField((prev) => (prev + 1) % fields.length);
      return;
    }

    if (key.name === "return" && !key.shift) {
      if (focusedField < fields.length - 1) {
        setFocusedField((prev) => prev + 1);
      } else {
        handleConnect();
      }
    }
  });

  const handleConnect = () => {
    if (!name || !host || !nickname || !ircClient) return;

    const context = {
      store,
      ircClient,
      renderer,
    };

    const params = {
      name,
      host,
      port: parseInt(port, 10) || 6667,
      nickname,
      password: password || undefined,
      saslUsername: saslUsername || undefined,
      saslPassword: saslPassword || undefined,
    };

    registry.execute("server.connectWith", context, params);
    closeModal();
  };

  const modalWidth = Math.min(50, width - 4);
  const modalHeight = Math.min(20, height - 4);
  const modalX = Math.floor((width - modalWidth) / 2);
  const modalY = Math.floor((height - modalHeight) / 2);

  return (
    <box
      position="absolute"
      left={modalX}
      top={modalY}
      width={modalWidth}
      height={modalHeight}
      border
      borderStyle="rounded"
      borderColor="#00FFFF"
      backgroundColor="#1a1a2e"
      flexDirection="column"
      title="Connect to Server"
      titleAlignment="center"
    >
      <scrollbox focused height={modalHeight - 4} padding={2}>
        {fields.map((field, index) => (
          <box key={field.label} flexDirection="column" marginBottom={1}>
            <text>
              <strong>{field.label}:</strong>
            </text>
            <input
              value={field.value}
              onChange={field.setValue}
              focused={focusedField === index}
              placeholder={field.placeholder}
              width={modalWidth - 6}
              backgroundColor="#2a2a3e"
              focusedBackgroundColor="#3a3a4e"
            />
          </box>
        ))}
      </scrollbox>

      <box
        padding={1}
        border
        borderColor="#444444"
        justifyContent="space-between"
        flexDirection="row"
      >
        <text fg="#666666">
          <span fg="#FFFFFF">Tab</span> Next • <span fg="#FFFFFF">Enter</span>{" "}
          Connect
        </text>
        <text fg="#666666">
          <span fg="#FFFFFF">Esc</span> Cancel
        </text>
      </box>
    </box>
  );
}
