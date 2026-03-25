import {
  memo
} from 'react'
import type { Guide } from '@whiteboard/core/node'
import type { NodeId, Rect } from '@whiteboard/core/types'
import {
  useInternalInstance,
  useFrameScope,
  usePickRef,
  useStoreValue
} from '../../../runtime/hooks'
import { useNodeOverlayView } from '../hooks/useNodeView'
import { useSelection } from '../selection'
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
  showHandles
}: {
  nodeId: NodeId
  showHandles: boolean
}) => {
  const view = useNodeOverlayView(nodeId)

  if (!view) return null

  const frameRect = view.node.type === 'shape'
    ? view.frameRect
    : view.rect

  return (
    <>
      {view.node.type === 'shape' ? (
        <div
          className="wb-node-transform-frame"
          style={{
            transform: `translate(${frameRect.x}px, ${frameRect.y}px)${view.rotation !== 0 ? ` rotate(${view.rotation}deg)` : ''}`,
            width: frameRect.width,
            height: frameRect.height,
            transformOrigin: view.rotation !== 0 ? 'center center' : undefined
          }}
        />
      ) : null}
      {showHandles && !view.node.locked ? (
        <NodeTransformHandles
          node={view.node}
          rect={frameRect}
          rotation={view.rotation}
          canResize={view.canResize}
          canRotate={view.canRotate}
        />
      ) : null}
    </>
  )
})

NodeTransformOverlayItem.displayName = 'NodeTransformOverlayItem'

const NodeConnectOverlayItem = memo(({
  nodeId
}: {
  nodeId: NodeId
}) => {
  const view = useNodeOverlayView(nodeId)

  if (!view || !view.canConnect) return null

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

const resolveFrameTitle = (
  node: {
    type: string
    data?: Record<string, unknown>
  }
) => {
  const title = node.data?.title
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  if (node.type === 'group') {
    return 'Group'
  }
  if (node.type === 'frame') {
    return 'Frame'
  }
  return node.type
}

const ActiveFrameOverlay = ({
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

const SelectionFrameOverlay = ({
  selection
}: {
  selection: ReturnType<typeof useSelection>
}) => {
  const interactive = selection.items.count > 1
  const ref = usePickRef({
    kind: 'selection-box',
    part: 'body'
  })

  if (!selection.box || selection.items.nodeCount === 0) {
    return null
  }

  return (
    <div
      ref={interactive ? ref : undefined}
      className="wb-selection-transform-box"
      style={{
        pointerEvents: interactive ? 'auto' : 'none',
        transform: `translate(${selection.box.x}px, ${selection.box.y}px)`,
        width: selection.box.width,
        height: selection.box.height
      }}
    />
  )
}

const SelectionHandlesOverlay = ({
  selection
}: {
  selection: ReturnType<typeof useSelection>
}) => {
  if (
    !selection.box
    || (
      selection.items.count <= 1
      && selection.transform.resize !== 'scale'
    )
  ) {
    return null
  }

  return (
    <TransformHandles
      rect={selection.box}
      rotation={0}
      canResize={selection.transform.resize === 'scale'}
      canRotate={false}
    />
  )
}

export const NodeOverlayLayer = () => {
  const instance = useInternalInstance()
  const chrome = useStoreValue(instance.read.chrome.node)
  const frame = useFrameScope()
  const guides = useStoreValue(instance.internals.snap.guides)
  const selection = useSelection()
  const activeFrameNode = useNodeOverlayView(frame.id)

  const activeFrame =
    frame.id && activeFrameNode
      ? {
          rect: activeFrameNode.rect,
          title: resolveFrameTitle(activeFrameNode.node)
        }
      : undefined
  const showSelectionFrame = Boolean(selection.box) && selection.items.nodeCount > 0
  const singleTransformNodeId = selection.kind === 'node'
    ? selection.target.nodeIds[0]
    : undefined
  const showSelectionHandles =
    chrome.transform
    && Boolean(selection.box)
    && selection.transform.resize === 'scale'
  const hideSelectionFrameForSingleShape =
    selection.kind === 'node'
    && selection.items.nodeCount === 1
    && selection.items.primaryNode?.type === 'shape'
  const connectNodeIds = chrome.connect ? selection.target.nodeIds : EMPTY_NODE_IDS

  return (
    <>
      <div className="wb-node-overlay-layer">
        {activeFrame ? (
          <ActiveFrameOverlay
            rect={activeFrame.rect}
            title={activeFrame.title}
          />
        ) : null}
        {singleTransformNodeId ? (
          <NodeTransformOverlayItem
            nodeId={singleTransformNodeId}
            showHandles={chrome.transform}
          />
        ) : null}
        {showSelectionFrame && !hideSelectionFrameForSingleShape ? (
          <SelectionFrameOverlay
            selection={selection}
          />
        ) : null}
        {showSelectionHandles ? (
          <SelectionHandlesOverlay
            selection={selection}
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
