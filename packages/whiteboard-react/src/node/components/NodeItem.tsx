import { memo, useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { TransformHandle } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeContainerProps, NodeRenderProps } from 'types/node'
import type { NodeReader } from '../../transient'
import { NodeBlock } from './NodeBlock'
import { NodeConnectHandles } from './NodeConnectHandles'
import { NodeTransformHandles } from './NodeTransformHandles'
import {
  buildNodeContainerStyle
} from './styles'
import { useNodeView } from '../hooks/useNodeView'

type NodeItemProps = {
  nodeId: NodeId
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  node: NodeReader
  onNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onTransformPointerDown: (
    nodeId: NodeId,
    handle: TransformHandle,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
}
export const NodeItem = memo(({
  nodeId,
  registerMeasuredElement,
  node,
  onNodePointerDown,
  onTransformPointerDown
}: NodeItemProps) => {
  const view = useNodeView(nodeId, node)

  if (!view) return null

  const {
    node: resolvedNode,
    rect,
    hovered,
    selected,
    rotation,
    shouldAutoMeasure,
    canRotate,
    shouldMountTransform,
    shouldMountConnectHandles,
    nodeStyle,
    transformStyle,
    connectHandleOverlayStyle,
    renderProps: baseRenderProps,
    definition
  } = view
  const setMeasuredElement = useCallback((element: HTMLDivElement | null) => {
    registerMeasuredElement(nodeId, element, shouldAutoMeasure)
  }, [nodeId, registerMeasuredElement, shouldAutoMeasure])
  const measuredElementRef = definition?.autoMeasure ? setMeasuredElement : undefined

  const containerProps: NodeContainerProps = {
    rect,
    nodeId,
    selected,
    ref: measuredElementRef,
    style: buildNodeContainerStyle(nodeStyle, transformStyle),
    onPointerDown: (event) => {
      onNodePointerDown(nodeId, event)
    }
  }
  const renderProps: NodeRenderProps = {
    ...baseRenderProps,
    containerProps
  }
  const content = definition ? definition.render(renderProps) : resolvedNode.type

  return (
    <>
      {definition?.renderContainer ? (
        definition.renderContainer(renderProps, content)
      ) : (
        <NodeBlock
          rect={rect}
          label={content}
          nodeId={nodeId}
          selected={selected}
          ref={containerProps.ref}
          style={containerProps.style}
          onPointerDown={containerProps.onPointerDown}
        />
      )}
      {shouldMountConnectHandles ? (
        <NodeConnectHandles
          node={resolvedNode}
          rect={rect}
          style={connectHandleOverlayStyle}
        />
      ) : null}
      {shouldMountTransform ? (
        <NodeTransformHandles
          node={resolvedNode}
          rect={rect}
          rotation={rotation}
          canRotate={canRotate}
          onTransformPointerDown={onTransformPointerDown}
        />
      ) : null}
    </>
  )
})

NodeItem.displayName = 'NodeItem'
