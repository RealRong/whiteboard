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
  handlePointerDown
}: Options) => {
  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      rect,
      nodeId: node.id,
      selected,
      style: { ...nodeStyle, ...rotationStyle, pointerEvents: 'auto' },
      onPointerDown: handlePointerDown,
      onPointerMove: dragHandlers.onPointerMove,
      onPointerUp: dragHandlers.onPointerUp
    }),
    [
      dragHandlers.onPointerMove,
      dragHandlers.onPointerUp,
      handlePointerDown,
      node.id,
      nodeStyle,
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
