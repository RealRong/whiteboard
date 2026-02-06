import type { Node } from '@whiteboard/core'
import { useCallback, useRef } from 'react'
import { useInstance } from '../../common/hooks'
import { useNodeInteraction, useNodePresentation, useNodeTransform } from '../hooks'
import { NodeBlock } from './NodeBlock'

export type NodeItemProps = {
  node: Node
}

export const NodeItem = ({ node }: NodeItemProps) => {
  const instance = useInstance()
  const interaction = useNodeInteraction({ node })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const setContainerRef = useCallback(
    (element: HTMLDivElement | null) => {
      if (containerRef.current === element) return
      if (containerRef.current) {
        instance.services.nodeSizeObserver.unobserve(node.id)
      }
      containerRef.current = element
      if (element) {
        instance.services.nodeSizeObserver.observe(node.id, element, true)
      }
    },
    [instance, node.id]
  )
  const presentation = useNodePresentation({
    node,
    dragHandlers: interaction.dragHandlers,
    handlePointerDown: interaction.handlePointerDown,
    onPointerEnter: interaction.onPointerEnter,
    onPointerLeave: interaction.onPointerLeave,
    containerRef: setContainerRef
  })
  const transform = useNodeTransform({
    node,
    canRotate: presentation.canRotate
  })
  return (
    <>
      {presentation.definition?.renderContainer ? (
        presentation.definition.renderContainer(presentation.renderProps, presentation.content)
      ) : (
        <NodeBlock
          rect={presentation.rect}
          label={presentation.content}
          nodeId={node.id}
          selected={presentation.selected}
          showHandles={false}
          ref={presentation.containerProps.ref}
          style={presentation.containerProps.style}
          onHandlePointerDown={interaction.handleEdgeHandlePointerDown}
          onPointerDown={presentation.containerProps.onPointerDown}
          onPointerMove={presentation.containerProps.onPointerMove}
          onPointerUp={presentation.containerProps.onPointerUp}
          onPointerEnter={presentation.containerProps.onPointerEnter}
          onPointerLeave={presentation.containerProps.onPointerLeave}
        />
      )}
      {transform.renderHandles()}
    </>
  )
}
