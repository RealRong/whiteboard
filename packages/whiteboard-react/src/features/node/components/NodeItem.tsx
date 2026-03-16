import { memo, useCallback, type CSSProperties } from 'react'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeContainerProps, NodeRenderProps } from '../../../types/node'
import { useInstance } from '../../../runtime/hooks'
import { NodeBlock } from './NodeBlock'
import { useNodeView } from '../hooks/useNodeView'

type NodeItemProps = {
  nodeId: NodeId
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  selected: boolean
  onNodePointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
}
export const NodeItem = memo(({
  nodeId,
  registerMeasuredElement,
  selected,
  onNodePointerDown,
  onNodeDoubleClick,
}: NodeItemProps) => {
  const instance = useInstance()
  const view = useNodeView(nodeId, { selected })

  if (!view) return null

  const {
    node: resolvedNode,
    rect,
    hovered,
    hasResizePreview,
    nodeStyle,
    transformStyle,
    definition
  } = view
  const shouldAutoMeasure = Boolean(definition?.autoMeasure) && !hasResizePreview
  const setMeasuredElement = useCallback((element: HTMLDivElement | null) => {
    registerMeasuredElement(nodeId, element, shouldAutoMeasure)
  }, [nodeId, registerMeasuredElement, shouldAutoMeasure])
  const measuredElementRef = definition?.autoMeasure ? setMeasuredElement : undefined

  const containerStyle: CSSProperties = {
    ...nodeStyle,
    pointerEvents: 'auto',
    ...transformStyle
  }
  const containerProps: NodeContainerProps = {
    rect,
    nodeId,
    selected,
    ref: measuredElementRef,
    style: containerStyle,
    onPointerDown: (event) => {
      onNodePointerDown(nodeId, event)
    },
    onDoubleClick: (event) => {
      onNodeDoubleClick(nodeId, event)
    }
  }
  const renderProps: NodeRenderProps = {
    read: instance.read,
    commands: instance.commands,
    node: resolvedNode,
    rect,
    selected,
    hovered,
    containerProps
  }
  const content = definition ? definition.render(renderProps) : resolvedNode.type

  return (
    definition?.renderContainer ? (
      definition.renderContainer(renderProps, content)
    ) : (
      <NodeBlock
        rect={rect}
        label={content}
        nodeId={nodeId}
        selected={selected}
        ref={containerProps.ref}
        style={containerStyle}
        onPointerDown={containerProps.onPointerDown}
        onDoubleClick={containerProps.onDoubleClick}
      />
    )
  )
})

NodeItem.displayName = 'NodeItem'
