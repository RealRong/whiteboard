import type { ContextMenuItem, ContextMenuSection } from '../types'

export const ContextMenuSectionView = ({
  section,
  onItemClick
}: {
  section: ContextMenuSection
  onItemClick: (item: ContextMenuItem) => void
}) => (
  <div className="wb-context-menu-section">
    {section.title ? (
      <div className="wb-context-menu-section-title">{section.title}</div>
    ) : null}
    {section.items.map((item) => (
      <button
        key={item.key}
        type="button"
        className="wb-context-menu-item"
        data-tone={item.tone === 'danger' ? 'danger' : undefined}
        disabled={item.disabled}
        data-context-menu-item={item.key}
        onClick={() => {
          if (item.disabled) return
          onItemClick(item)
        }}
        data-context-menu-ignore
        data-selection-ignore
        data-input-ignore
      >
        {item.label}
      </button>
    ))}
  </div>
)
