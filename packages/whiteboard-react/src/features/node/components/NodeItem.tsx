import { memo, useCallback, type CSSProperties } from 'react'
import type {
  MouseEvent as ReactMouseEvent
} from 'react'
import type { NodeId } from '@whiteboard/core/types'
import type { NodeRenderProps } from '../../../types/node'
import { usePickRef } from '../../../runtime/hooks'
import { useNodeView } from '../hooks/useNodeView'

type NodeItemProps = {
  nodeId: NodeId
  registerMeasuredElement: (
    nodeId: NodeId,
    element: HTMLDivElement | null,
    enabled: boolean
  ) => void
  selected: boolean
  onNodeDoubleClick: (
    nodeId: NodeId,
    event: ReactMouseEvent<HTMLDivElement>
  ) => void
}
export const NodeItem = memo(({
  nodeId,
  registerMeasuredElement,
  selected,
  onNodeDoubleClick,
}: NodeItemProps) => {
  const view = useNodeView(nodeId, { selected })

  if (!view) return null

  const {
    node: resolvedNode,
    rect,
    hovered,
    hasResizePreview,
    nodeStyle,
    transformStyle,
    definition,
    update,
    updateData
  } = view
  const shouldAutoMeasure = Boolean(definition?.autoMeasure) && !hasResizePreview
  const hit = definition?.hit ?? 'box'
  const setPickElement = usePickRef({
    kind: 'node',
    id: nodeId,
    part: 'body'
  })
  const setMeasuredElement = useCallback((element: HTMLDivElement | null) => {
    registerMeasuredElement(nodeId, element, shouldAutoMeasure)
  }, [nodeId, registerMeasuredElement, shouldAutoMeasure])
  const setRootElement = useCallback((element: HTMLDivElement | null) => {
    setPickElement(element)
    if (definition?.autoMeasure) {
      setMeasuredElement(element)
    }
  }, [definition?.autoMeasure, setMeasuredElement, setPickElement])

  const rootStyle: CSSProperties = {
    ...nodeStyle,
    pointerEvents: hit === 'path' ? 'none' : 'auto',
    ...transformStyle
  }
  const renderProps: NodeRenderProps = {
    node: resolvedNode,
    rect,
    selected,
    hovered,
    update,
    updateData
  }
  const content = definition ? definition.render(renderProps) : resolvedNode.type

  return (
    <div
      ref={setRootElement}
      className="wb-node-block"
      data-node-id={nodeId}
      data-node-type={resolvedNode.type}
      data-node-hit={hit}
      data-selected={selected ? 'true' : undefined}
      onDoubleClick={(event) => {
        onNodeDoubleClick(nodeId, event)
      }}
      style={{
        width: rect.width,
        height: rect.height,
        ...rootStyle
      }}
    >
      {content}
    </div>
  )
})

NodeItem.displayName = 'NodeItem'
