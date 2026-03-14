import {
  memo,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { Guide, TransformHandle } from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import { useNodeIds } from '../../common/hooks'
import { useOverlayView } from '../../overlay/view'
import { useSelection } from '../../selection'
import { useNodeOverlayView } from '../hooks/useNodeView'
import { NodeConnectHandles } from './NodeConnectHandles'
import { NodeTransformHandles } from './NodeTransformHandles'

const NodeInteractionGuidesLayer = ({
  guides
}: {
  guides: readonly Guide[]
}) => {
  if (!guides.length) return null

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-drag-guides-layer"
    >
      {guides.map((guide, index) => (
        <line
          key={`${guide.axis}-${index}`}
          x1={guide.axis === 'x' ? guide.value : guide.from}
          y1={guide.axis === 'x' ? guide.from : guide.value}
          x2={guide.axis === 'x' ? guide.value : guide.to}
          y2={guide.axis === 'x' ? guide.to : guide.value}
          stroke="rgba(59,130,246,0.9)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
    </svg>
  )
}

const NodeTransformOverlayItem = memo(({
  nodeId,
  onTransformPointerDown
}: {
  nodeId: NodeId
  onTransformPointerDown: (
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}) => {
  const view = useNodeOverlayView(nodeId, {
    selected: true
  })

  if (!view || view.node.locked) return null

  return (
    <NodeTransformHandles
      node={view.node}
      rect={view.rect}
      rotation={view.rotation}
      canRotate={view.canRotate}
      onTransformPointerDown={onTransformPointerDown}
    />
  )
})

NodeTransformOverlayItem.displayName = 'NodeTransformOverlayItem'

const NodeConnectOverlayItem = memo(({
  nodeId,
  selected
}: {
  nodeId: NodeId
  selected: boolean
}) => {
  const view = useNodeOverlayView(nodeId, {
    selected
  })

  if (!view || (!selected && !view.hovered)) return null

  return (
    <NodeConnectHandles
      node={view.node}
      rect={view.rect}
      style={view.connectHandleOverlayStyle}
    />
  )
})

NodeConnectOverlayItem.displayName = 'NodeConnectOverlayItem'

const ActiveContainerOverlay = ({
  rect,
  title
}: {
  rect: Rect
  title: string
}) => (
  <div
    className="wb-container-scope-outline"
    style={{
      transform: `translate(${rect.x}px, ${rect.y}px)`,
      width: rect.width,
      height: rect.height
    }}
  >
    <div className="wb-container-scope-badge">{`Editing: ${title}`}</div>
  </div>
)

export const NodeOverlayLayer = ({
  onTransformPointerDown
}: {
  onTransformPointerDown: (
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}) => {
  const nodeIds = useNodeIds()
  const overlay = useOverlayView()
  const selection = useSelection()
  const selectedSet = selection.nodeIdSet

  return (
    <>
      <div className="wb-node-layer">
        {overlay.activeScope ? (
          <ActiveContainerOverlay
            rect={overlay.activeScope.rect}
            title={overlay.activeScope.title}
          />
        ) : null}
        {overlay.nodeHandleNodeIds.map((nodeId: NodeId) => (
          <NodeTransformOverlayItem
            key={`transform:${nodeId}`}
            nodeId={nodeId}
            onTransformPointerDown={onTransformPointerDown}
          />
        ))}
        {overlay.showNodeConnectHandles && nodeIds.map((nodeId) => (
          <NodeConnectOverlayItem
            key={`connect:${nodeId}`}
            nodeId={nodeId}
            selected={selectedSet.has(nodeId)}
          />
        ))}
      </div>
      <NodeInteractionGuidesLayer guides={overlay.guides} />
    </>
  )
}
