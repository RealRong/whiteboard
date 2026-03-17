import type { ReactNode } from 'react'

export const COLORS = [
  '#111827',
  '#ffffff',
  '#f8fafc',
  '#fef3c7',
  '#fee2e2',
  '#dbeafe',
  '#dcfce7',
  '#ede9fe',
  '#fbcfe8',
  '#94a3b8',
  '#ef4444',
  '#f59e0b',
  '#10b981',
  '#2563eb',
  '#7c3aed'
] as const

export const STROKE_WIDTHS = [1, 2, 4, 6] as const
export const FONT_SIZES = [12, 14, 16, 20, 24] as const

export const ColorSwatch = ({
  color,
  active = false,
  onClick
}: {
  color: string
  active?: boolean
  onClick: () => void
}) => (
  <button
    type="button"
    className="wb-node-toolbar-swatch"
    data-active={active ? 'true' : undefined}
    style={{ ['--wb-swatch-color' as string]: color }}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
    aria-label={color}
  />
)

export const MenuSection = ({
  title,
  children
}: {
  title: string
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-menu-section">
    <div className="wb-node-toolbar-menu-title">{title}</div>
    {children}
  </div>
)

export const ChipRow = ({
  children
}: {
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-chip-row">
    {children}
  </div>
)

export const ChipColumn = ({
  children
}: {
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-chip-column">
    {children}
  </div>
)

export const Chip = ({
  active = false,
  disabled = false,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    className="wb-node-toolbar-chip"
    data-active={active ? 'true' : undefined}
    disabled={disabled}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
  >
    {children}
  </button>
)
