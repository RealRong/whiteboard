type ColorSwatchProps = {
  color: string
  active: boolean
  onClick: () => void
}

export const ColorSwatch = ({
  color,
  active,
  onClick
}: ColorSwatchProps) => (
  <button
    type="button"
    className="wb-node-toolbar-swatch"
    data-active={active ? 'true' : undefined}
    style={{ background: color }}
    onClick={onClick}
    data-selection-ignore
    data-input-ignore
  />
)
