import type { Node } from '@whiteboard/core'
import { useCallback, useMemo, useRef } from 'react'
import type { NodeContainerProps, NodeRenderProps } from '../registry/nodeRegistry'
import { renderNodeDefinition } from '../registry/defaultNodes'
import { useInstance } from '../../common/hooks'
import { useNodeInteraction, useNodePresentation, useNodeTransform } from '../hooks'
import { NodeBlock } from './NodeBlock'

export type NodeItemProps = {
  node: Node
}

export const NodeItem = ({ node }: NodeItemProps) => {
  const instance = useInstance()
  const interaction = useNodeInteraction({ node })
  const containerRef = useRef<HTMLDivElement>(null)

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
    containerRef: setContainerRef
  })

  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      ...presentation.containerProps,
      ...interaction.containerHandlers
    }),
    [interaction.containerHandlers, presentation.containerProps]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      ...presentation.renderProps,
      containerProps
    }),
    [containerProps, presentation.renderProps]
  )

  const content = useMemo(
    () => renderNodeDefinition(presentation.definition, renderProps),
    [presentation.definition, renderProps]
  )

  const transform = useNodeTransform({
    node,
    canRotate: presentation.canRotate
  })

  return (
    <>
      {presentation.definition?.renderContainer ? (
        presentation.definition.renderContainer(renderProps, content)
      ) : (
        <NodeBlock
          rect={presentation.rect}
          label={content}
          nodeId={node.id}
          selected={presentation.selected}
          showHandles={false}
          ref={containerProps.ref}
          style={containerProps.style}
          onHandlePointerDown={interaction.handleEdgeHandlePointerDown}
          onPointerDown={containerProps.onPointerDown}
          onPointerMove={containerProps.onPointerMove}
          onPointerUp={containerProps.onPointerUp}
          onPointerEnter={containerProps.onPointerEnter}
          onPointerLeave={containerProps.onPointerLeave}
        />
      )}
      {transform.renderHandles()}
    </>
  )
}
