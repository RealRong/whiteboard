import { useMemo } from 'react'
import type { Core, Node, Rect } from '@whiteboard/core'
import type { CSSProperties, PointerEvent } from 'react'
import type { NodeContainerProps, NodeDefinition, NodeRenderProps } from '../registry/nodeRegistry'
import { renderNodeDefinition } from '../registry/defaultNodes'

type DragHandlers = {
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
}

type Options = {
  core: Core
  node: Node
  rect: Rect
  selected: boolean
  hovered: boolean
  zoom: number
  definition?: NodeDefinition
  nodeStyle: CSSProperties
  rotationStyle?: CSSProperties
  dragHandlers: DragHandlers
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerEnter?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave?: (event: PointerEvent<HTMLDivElement>) => void
}

export const useNodeRenderModel = ({
  core,
  node,
  rect,
  selected,
  hovered,
  zoom,
  definition,
  nodeStyle,
  rotationStyle,
  dragHandlers,
  handlePointerDown,
  onPointerEnter,
  onPointerLeave
}: Options) => {
  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      rect,
      nodeId: node.id,
      selected,
      style: buildContainerStyle(rect, nodeStyle, rotationStyle),
      onPointerDown: handlePointerDown,
      onPointerMove: dragHandlers.onPointerMove,
      onPointerUp: dragHandlers.onPointerUp,
      onPointerEnter,
      onPointerLeave
    }),
    [
      dragHandlers.onPointerMove,
      dragHandlers.onPointerUp,
      handlePointerDown,
      node.id,
      nodeStyle,
      onPointerEnter,
      onPointerLeave,
      rect,
      rotationStyle,
      selected
    ]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      core,
      node,
      rect,
      selected,
      hovered,
      zoom,
      containerProps
    }),
    [containerProps, core, hovered, node, rect, selected, zoom]
  )

  const content = renderNodeDefinition(definition, renderProps)

  return { containerProps, renderProps, content }
}

const buildContainerStyle = (
  rect: Rect,
  nodeStyle: CSSProperties,
  rotationStyle?: CSSProperties
): CSSProperties => {
  const baseTransform = `translate(${rect.x}px, ${rect.y}px)`
  const extraTransform = nodeStyle.transform
  const rotationTransform = rotationStyle?.transform
  const combinedTransform = [baseTransform, extraTransform, rotationTransform].filter(Boolean).join(' ')

  return {
    ...nodeStyle,
    ...rotationStyle,
    pointerEvents: 'auto',
    transform: combinedTransform,
    transformOrigin: rotationStyle?.transformOrigin ?? nodeStyle.transformOrigin
  }
}
