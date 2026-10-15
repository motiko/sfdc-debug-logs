import { keyLabel, keySpokenNames } from '../../core/key-labels'

// A key combination as <kbd> elements: "Mod+f" -> Ctrl F (⌘ F on macOS).
// Symbols are hidden from screen readers, which read their names instead,
// and drawn in the UI font, larger: the mono font's ⇧ and ⌥ are tiny.
const SYMBOL_STYLE = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: '1.25em',
  lineHeight: 1
}
export default function Keys({ keys }) {
  const parts = keyLabel(keys)
  const spoken = keySpokenNames(keys)
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {parts.map((part, i) => (
        <kbd key={i}>
          {spoken[i] ? (
            <>
              <span
                aria-hidden="true"
                style={part.length === 1 ? SYMBOL_STYLE : undefined}
              >
                {part}
              </span>
              <span className="sr-only">{spoken[i]}</span>
            </>
          ) : (
            part
          )}
        </kbd>
      ))}
    </span>
  )
}
