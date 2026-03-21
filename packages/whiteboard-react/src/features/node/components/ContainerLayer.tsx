import { memo, useMemo, type CSSProperties } from 'react'
import type {
  NodeId
} from '@whiteboard/core/types'
import {
  useInternalInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import type { NodeGesture } from '../gesture'
import { useNodeView } from '../hooks/useNodeView'
import { GroupNodeChrome } from '../registry/default/group'

const ContainerBackgroundItem = memo(({
  nodeId
}: {
  nodeId: NodeId
}) => {
  const view = useNodeView(nodeId)

  if (!view) {
    return null
  }

  const rootStyle: CSSProperties = {
    width: view.rect.width,
    height: view.rect.height,
    ...view.transformStyle
  }
  const fillStyle: CSSProperties = {
    background: view.nodeStyle.background,
    borderRadius: view.nodeStyle.borderRadius
  }

  return (
    <div className="wb-container-block" style={rootStyle}>
      <div className="wb-container-fill" style={fillStyle} />
    </div>
  )
})

ContainerBackgroundItem.displayName = 'ContainerBackgroundItem'

const ContainerChromeItem = memo(({
  nodeId,
  selected,
  gesture
}: {
  nodeId: NodeId
  selected: boolean
  gesture: NodeGesture
}) => {
  const view = useNodeView(nodeId, { selected })

  if (!view) {
    return null
  }

  const rootStyle: CSSProperties = {
    width: view.rect.width,
    height: view.rect.height,
    ...view.transformStyle
  }
  const frameStyle: CSSProperties = {
    border: view.nodeStyle.border,
    borderRadius: view.nodeStyle.borderRadius,
    boxShadow: view.nodeStyle.boxShadow
  }

  return (
    <div
      className="wb-container-shell"
      data-node-id={nodeId}
      data-selected={selected ? 'true' : undefined}
      style={rootStyle}
    >
      <div className="wb-container-shell-frame" style={frameStyle} />
      <GroupNodeChrome
        node={view.node}
        updateData={view.updateData}
        onHeaderPointerDown={(event) => {
          gesture.handleNodePointerDown(nodeId, event)
        }}
        onHeaderDoubleClick={(event) => {
          gesture.handleNodeDoubleClick(nodeId, event)
        }}
      />
    </div>
  )
})

ContainerChromeItem.displayName = 'ContainerChromeItem'

export const ContainerLayer = () => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const containerIds = useMemo(
    () => instance.read.node.filter(nodeIds, 'container'),
    [instance, nodeIds]
  )

  if (!containerIds.length) {
    return null
  }

  return (
    <div className="wb-container-layer">
      {containerIds.map((nodeId) => (
        <ContainerBackgroundItem
          key={nodeId}
          nodeId={nodeId}
        />
      ))}
    </div>
  )
}

export const ContainerChromeLayer = ({
  gesture
}: {
  gesture: NodeGesture
}) => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const chrome = useStoreValue(instance.read.node.chrome)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const containerIds = useMemo(
    () => instance.read.node.filter(nodeIds, 'container'),
    [instance, nodeIds]
  )

  if (!containerIds.length) {
    return null
  }

  return (
    <div className="wb-container-chrome-layer">
      {containerIds.map((nodeId) => (
        <ContainerChromeItem
          key={nodeId}
          nodeId={nodeId}
          selected={selectedSet.has(nodeId) && chrome.selection}
          gesture={gesture}
        />
      ))}
    </div>
  )
}
