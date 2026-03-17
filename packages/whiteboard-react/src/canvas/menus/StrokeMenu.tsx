import {
  COLORS,
  STROKE_WIDTHS,
  Chip,
  ChipRow,
  ColorSwatch,
  MenuSection
} from './MenuPrimitives'

export const StrokeMenu = ({
  stroke,
  strokeWidth,
  onStrokeChange,
  onStrokeWidthChange
}: {
  stroke?: string
  strokeWidth?: number
  onStrokeChange?: (value: string) => void
  onStrokeWidthChange?: (value: number) => void
}) => (
  <>
    {onStrokeChange ? (
      <MenuSection title="Stroke">
        <div className="wb-node-toolbar-swatch-grid">
          {COLORS.map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              active={stroke === color}
              onClick={() => {
                onStrokeChange(color)
              }}
            />
          ))}
        </div>
      </MenuSection>
    ) : null}
    {onStrokeWidthChange ? (
      <MenuSection title="Width">
        <ChipRow>
          {STROKE_WIDTHS.map((value) => (
            <Chip
              key={value}
              active={strokeWidth === value}
              onClick={() => {
                onStrokeWidthChange(value)
              }}
            >
              {value}
            </Chip>
          ))}
        </ChipRow>
      </MenuSection>
    ) : null}
  </>
)
