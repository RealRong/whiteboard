import {
  COLORS,
  ColorSwatch,
  ToolbarMenuSection
} from './controls'
import { hasSchemaField } from '../schema'
import type { NodeToolbarActionContext } from '../types'
import {
  mergeData,
  updateNodesStyle
} from './actions'

export const FillMenu = ({
  instance,
  nodes,
  primaryNode,
  primarySchema
}: NodeToolbarActionContext) => {
  const showFill = !primarySchema || hasSchemaField(primarySchema, 'style', 'fill')
  const activeFill = typeof primaryNode.style?.fill === 'string'
    ? primaryNode.style.fill
    : primaryNode.type === 'sticky' && typeof primaryNode.data?.background === 'string'
      ? primaryNode.data.background
      : undefined

  if (!showFill) return null

  return (
    <ToolbarMenuSection title="Fill">
      <div className="wb-node-toolbar-swatch-grid">
        {COLORS.map((color) => (
          <ColorSwatch
            key={color}
            color={color}
            active={activeFill === color}
            onClick={() => {
              void updateNodesStyle(instance, nodes, { fill: color })
              const stickyNodes = nodes.filter((node) => node.type === 'sticky')
              if (stickyNodes.length) {
                void instance.commands.node.updateMany(stickyNodes.map((node) => ({
                  id: node.id,
                  patch: {
                    data: mergeData(node.data, { background: color })
                  }
                })))
              }
            }}
          />
        ))}
      </div>
    </ToolbarMenuSection>
  )
}
