import { memo, useMemo, type CSSProperties } from 'react'
import type {
  NodeId
} from '@whiteboard/core/types'
import {
  useInternalInstance,
  useSelection,
  useStoreValue
} from '../../../runtime/hooks'
import type { NodePressSession } from '../hooks/drag/session'
import { useNodeView } from '../hooks/useNodeView'
import { filterNodeIdsByScene } from '../scene'
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
  pressSession
}: {
  nodeId: NodeId
  selected: boolean
  pressSession: NodePressSession
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
          pressSession.handleNodePointerDown(nodeId, event)
        }}
        onHeaderDoubleClick={(event) => {
          pressSession.handleNodeDoubleClick(nodeId, event)
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
    () => filterNodeIdsByScene(instance, nodeIds, 'container'),
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
  pressSession
}: {
  pressSession: NodePressSession
}) => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
  const chrome = useStoreValue(instance.read.node.chrome)
  const selection = useSelection()
  const selectedSet = selection.target.nodeSet
  const containerIds = useMemo(
    () => filterNodeIdsByScene(instance, nodeIds, 'container'),
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
          pressSession={pressSession}
        />
      ))}
    </div>
  )
}
