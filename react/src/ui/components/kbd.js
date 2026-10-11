import { keyLabel } from '../../core/app-shortcuts'

// A key combination as <kbd> elements: "Mod+f" -> Ctrl F (⌘ F on macOS).
export default function Keys({ keys }) {
  const parts = keyLabel(keys)
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {parts.map((part, i) => (
        <kbd key={i}>{part}</kbd>
      ))}
    </span>
  )
}
