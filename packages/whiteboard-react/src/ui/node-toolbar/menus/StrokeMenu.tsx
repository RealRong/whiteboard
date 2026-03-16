import {
  COLORS,
  STROKE_WIDTHS,
  ColorSwatch,
  ToolbarChip,
  ToolbarChipRow,
  ToolbarMenuSection
} from './controls'
import { hasSchemaField } from '../schema'
import type { NodeToolbarActionContext } from '../types'
import {
  updateNodesStyle
} from './actions'

export const StrokeMenu = ({
  instance,
  nodes,
  primaryNode,
  primarySchema
}: NodeToolbarActionContext) => {
  const showStroke = !primarySchema || hasSchemaField(primarySchema, 'style', 'stroke')
  const showStrokeWidth = !primarySchema || hasSchemaField(primarySchema, 'style', 'strokeWidth')
  const stroke = typeof primaryNode.style?.stroke === 'string' ? primaryNode.style.stroke : '#1d1d1f'
  const strokeWidth = typeof primaryNode.style?.strokeWidth === 'number' ? primaryNode.style.strokeWidth : 1

  if (!showStroke && !showStrokeWidth) return null

  return (
    <>
      {showStroke ? (
        <ToolbarMenuSection title="Stroke">
          <div className="wb-node-toolbar-swatch-grid">
            {COLORS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                active={stroke === color}
                onClick={() => {
                  void updateNodesStyle(instance, nodes, { stroke: color })
                }}
              />
            ))}
          </div>
        </ToolbarMenuSection>
      ) : null}
      {showStrokeWidth ? (
        <ToolbarMenuSection title="Width">
          <ToolbarChipRow>
            {STROKE_WIDTHS.map((width) => (
              <ToolbarChip
                key={width}
                active={strokeWidth === width}
                onClick={() => {
                  void updateNodesStyle(instance, nodes, { strokeWidth: width })
                }}
              >
                {width}
              </ToolbarChip>
            ))}
          </ToolbarChipRow>
        </ToolbarMenuSection>
      ) : null}
    </>
  )
}
