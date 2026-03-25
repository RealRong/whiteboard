import { memo, useCallback, useMemo, type CSSProperties } from 'react'
import type {
  NodeId
} from '@whiteboard/core/types'
import {
  useInternalInstance,
  usePickRef,
  useStoreValue
} from '../../../runtime/hooks'
import type { NodeGesture } from '../gesture'
import { useNodeView } from '../hooks/useNodeView'
import { useSelection } from '../selection'
import { FrameNodeChrome } from '../registry/default/frame'

const FrameBodyHitItem = memo(({
  nodeId,
  selected,
  gesture
}: {
  nodeId: NodeId
  selected: boolean
  gesture: NodeGesture
}) => {
  const view = useNodeView(nodeId)
  const bindPickRef = usePickRef({
    kind: 'node',
    id: nodeId,
    part: 'container'
  })

  if (!view) {
    return null
  }

  const canHitBody =
    view.node.type !== 'group'
    || selected
  const ref = useCallback((element: HTMLDivElement | null) => {
    bindPickRef(canHitBody ? element : null)
  }, [bindPickRef, canHitBody])
  const rootStyle: CSSProperties = {
    width: view.rect.width,
    height: view.rect.height,
    pointerEvents: canHitBody ? 'auto' : 'none',
    ...view.transformStyle
  }
  const fillStyle: CSSProperties = {
    background: view.nodeStyle.background,
    borderRadius: view.nodeStyle.borderRadius
  }

  return (
    <div
      ref={ref}
      className="wb-container-block"
      style={rootStyle}
      onDoubleClick={view.node.type === 'frame'
        ? (event) => {
          gesture.doubleClick(nodeId, event)
        }
        : undefined}
    >
      <div
        className="wb-container-fill"
        style={fillStyle}
      />
    </div>
  )
})

FrameBodyHitItem.displayName = 'FrameBodyHitItem'

const ContainerChromeItem = memo(({
  nodeId,
  gesture
}: {
  nodeId: NodeId
  gesture: NodeGesture
}) => {
  const view = useNodeView(nodeId)

  if (!view) {
    return null
  }

  if (view.node.type !== 'frame') {
    return null
  }

  const isFrame = view.node.type === 'frame'
  const rootStyle: CSSProperties = {
    width: view.rect.width,
    height: view.rect.height,
    ...view.transformStyle
  }
  const frameStyle: CSSProperties = {
    border: isFrame ? view.nodeStyle.border : undefined,
    borderRadius: view.nodeStyle.borderRadius,
    boxShadow: isFrame ? view.nodeStyle.boxShadow : undefined
  }

  return (
    <div
      className="wb-container-shell"
      data-node-id={nodeId}
      style={rootStyle}
    >
      {isFrame ? (
        <div
          className="wb-container-shell-frame"
          style={frameStyle}
        />
      ) : null}
      {isFrame ? (
        <FrameNodeChrome
          node={view.renderProps.node}
          write={view.renderProps.write}
          onDoubleClick={(event) => {
            gesture.doubleClick(nodeId, event)
          }}
        />
      ) : null}
    </div>
  )
})

ContainerChromeItem.displayName = 'ContainerChromeItem'

export const FrameLayer = ({
  gesture
}: {
  gesture: NodeGesture
}) => {
  const instance = useInternalInstance()
  const nodeIds = useStoreValue(instance.read.node.list)
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
    <div className="wb-container-layer">
      {containerIds.map((nodeId) => (
        <FrameBodyHitItem
          key={nodeId}
          nodeId={nodeId}
          selected={selectedSet.has(nodeId)}
          gesture={gesture}
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
          gesture={gesture}
        />
      ))}
    </div>
  )
}
