import {
  memo,
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent
} from 'react'
import type { Guide, TransformHandle } from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import {
  useInternalInstance,
  useInteraction,
  useContainer,
  useSelection,
  useTool,
  useStoreValue
} from '../../../runtime/hooks'
import { useGuidesSession } from '../session/guides'
import { useNodeOverlayView, useNodeView } from '../hooks/useNodeView'
import { createNodeTransformSession } from '../hooks/transform/session'
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

const EMPTY_NODE_IDS: readonly NodeId[] = []

const resolveContainerTitle = (
  node: {
    type: string
    data?: Record<string, unknown>
  }
) => {
  const title = node.data?.title
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return node.type === 'group' ? 'Group' : node.type
}

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

export const NodeOverlayLayer = () => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const tool = useTool()
  const container = useContainer()
  const interaction = useInteraction()
  const guides = useGuidesSession(instance.internals.node.guides)
  const selection = useSelection()
  const activeContainerNode = useNodeView(container.id)
  const transformSessionRef = useRef<ReturnType<typeof createNodeTransformSession> | null>(null)
  const selectedSet = selection.target.nodeSet
  const chromeVisible = interaction === 'idle'

  if (!transformSessionRef.current) {
    transformSessionRef.current = createNodeTransformSession(instance)
  }

  const transformSession = transformSessionRef.current!

  useEffect(() => () => {
    transformSession.cancel()
  }, [transformSession])

  const activeContainer =
    container.id && activeContainerNode
      ? {
          rect: activeContainerNode.rect,
          title: resolveContainerTitle(activeContainerNode.node)
        }
      : undefined
  const showNodeHandles =
    tool === 'select'
    && selection.target.edgeId === undefined
    && (interaction === 'node-transform' || chromeVisible)
  const nodeHandleNodeIds = showNodeHandles ? selection.target.nodeIds : EMPTY_NODE_IDS
  const showNodeConnectHandles =
    tool === 'edge'
    && chromeVisible

  return (
    <>
      <div className="wb-node-layer">
        {activeContainer ? (
          <ActiveContainerOverlay
            rect={activeContainer.rect}
            title={activeContainer.title}
          />
        ) : null}
        {nodeHandleNodeIds.map((nodeId: NodeId) => (
          <NodeTransformOverlayItem
            key={`transform:${nodeId}`}
            nodeId={nodeId}
            onTransformPointerDown={transformSession.handleTransformPointerDown}
          />
        ))}
        {showNodeConnectHandles && nodeIds.map((nodeId) => (
          <NodeConnectOverlayItem
            key={`connect:${nodeId}`}
            nodeId={nodeId}
            selected={selectedSet.has(nodeId)}
          />
        ))}
      </div>
      <NodeInteractionGuidesLayer guides={guides} />
    </>
  )
}
