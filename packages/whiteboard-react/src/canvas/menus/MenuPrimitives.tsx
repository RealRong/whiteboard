import type { ReactNode } from 'react'

export const COLORS = [
  'hsl(var(--ui-text-primary, 40 2.1% 28%))',
  'hsl(var(--ui-surface, 0 0% 100%))',
  'hsl(var(--ui-surface-muted, 40 9.1% 93.5%))',
  'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))',
  'hsl(var(--tag-red-background, 5.7 77.8% 94.7%))',
  'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))',
  'hsl(var(--tag-green-background, 146.7 24.3% 92.7%))',
  'hsl(var(--tag-purple-background, 274.3 53.8% 94.9%))',
  'hsl(var(--tag-pink-background, 331.8 63% 94.7%))',
  'hsl(var(--ui-text-secondary, 37.5 3.3% 47.5%))',
  'hsl(var(--ui-danger, 4 58.4% 54.7%))',
  'hsl(var(--tag-orange-foreground, 28.4 64.7% 50%))',
  'hsl(var(--tag-green-foreground, 146.5 29.8% 44.7%))',
  'hsl(var(--ui-accent, 209.8 76.7% 51.2%))',
  'hsl(var(--tag-purple-foreground, 278.6 32.7% 56.3%))'
] as const

export const STROKE_WIDTHS = [1, 2, 4, 6] as const
export const FONT_SIZES = [14, 16, 20, 24] as const

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
  tone,
  onClick,
  children
}: {
  active?: boolean
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    className="wb-node-toolbar-chip"
    data-active={active ? 'true' : undefined}
    data-tone={tone}
    disabled={disabled}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
  >
    {children}
  </button>
)

export const MenuList = ({
  children
}: {
  children: ReactNode
}) => (
  <div className="wb-node-toolbar-menu-list">
    {children}
  </div>
)

export const MenuItem = ({
  disabled = false,
  tone,
  onClick,
  children
}: {
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
  children: ReactNode
}) => (
  <button
    type="button"
    className="wb-node-toolbar-menu-item"
    disabled={disabled}
    data-tone={tone}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
  >
    {children}
  </button>
)
