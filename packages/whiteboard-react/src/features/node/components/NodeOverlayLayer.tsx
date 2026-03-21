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
  useContainer,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import { useNodeOverlayView } from '../hooks/useNodeView'
import { createTransformSession } from '../hooks/transform/session'
import { NodeConnectHandles } from './NodeConnectHandles'
import {
  NodeTransformHandles,
  TransformHandles
} from './NodeTransformHandles'

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
          stroke="var(--wb-selection-border)"
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
  const view = useNodeOverlayView(nodeId)

  if (!view || view.node.locked) return null

  return (
    <NodeTransformHandles
      node={view.node}
      rect={view.rect}
      rotation={view.rotation}
      canResize={view.canResize}
      canRotate={view.canRotate}
      onTransformPointerDown={onTransformPointerDown}
    />
  )
})

NodeTransformOverlayItem.displayName = 'NodeTransformOverlayItem'

const NodeConnectOverlayItem = memo(({
  nodeId
}: {
  nodeId: NodeId
}) => {
  const view = useNodeOverlayView(nodeId)

  if (!view) return null

  return (
    <NodeConnectHandles
      node={view.node}
      rect={view.rect}
      rotation={view.rotation}
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

const SelectionTransformOverlay = ({
  selection,
  onTransformPointerDown
}: {
  selection: ReturnType<typeof useSelection>
  onTransformPointerDown: (
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}) => {
  if (selection.items.count <= 1 || !selection.box) {
    return null
  }

  return (
    <>
      <div
        className="wb-selection-transform-box"
        style={{
          transform: `translate(${selection.box.x}px, ${selection.box.y}px)`,
          width: selection.box.width,
          height: selection.box.height
        }}
      />
      <TransformHandles
        rect={selection.box}
        rotation={0}
        canResize={selection.transform.resize !== 'none'}
        canRotate={selection.transform.rotate}
        onTransformPointerDown={onTransformPointerDown}
      />
    </>
  )
}

export const NodeOverlayLayer = () => {
  const instance = useInternalInstance()
  const chrome = useStoreValue(instance.read.node.chrome)
  const container = useContainer()
  const guides = useStoreValue(instance.internals.node.guides)
  const selection = useSelection()
  const activeContainerNode = useNodeOverlayView(container.id)
  const transformSessionRef = useRef<ReturnType<typeof createTransformSession> | null>(null)

  if (!transformSessionRef.current) {
    transformSessionRef.current = createTransformSession(instance)
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
  const singleTransformNodeId =
    chrome.transform && selection.items.count === 1
      ? selection.target.nodeIds[0]
      : undefined
  const connectNodeIds = chrome.connect ? selection.target.nodeIds : EMPTY_NODE_IDS

  return (
    <>
      <div className="wb-node-overlay-layer">
        {activeContainer ? (
          <ActiveContainerOverlay
            rect={activeContainer.rect}
            title={activeContainer.title}
          />
        ) : null}
        {singleTransformNodeId ? (
          <NodeTransformOverlayItem
            nodeId={singleTransformNodeId}
            onTransformPointerDown={transformSession.handleNodePointerDown}
          />
        ) : null}
        {chrome.transform ? (
          <SelectionTransformOverlay
            selection={selection}
            onTransformPointerDown={transformSession.handleSelectionPointerDown}
          />
        ) : null}
        {connectNodeIds.map((nodeId) => (
          <NodeConnectOverlayItem
            key={`connect:${nodeId}`}
            nodeId={nodeId}
          />
        ))}
      </div>
      <NodeInteractionGuidesLayer guides={guides} />
    </>
  )
}
