import { useMemo } from 'react'
import type { CSSProperties, PointerEvent, ReactNode, Ref } from 'react'
import type { Core, Node, Rect } from '@whiteboard/core'
import { useAtomValue } from 'jotai'
import type { NodeContainerProps, NodeDefinition, NodeRenderProps } from '../registry/nodeRegistry'
import { getNodeDefinitionStyle, renderNodeDefinition } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useInstance, useViewportStore, useWhiteboardConfig } from '../../common/hooks'
import { getNodeRect } from '../../common/utils/geometry'
import { selectionAtom } from '../../common/state'
import { useGroupRuntime } from './useGroupRuntime'

type DragHandlers = {
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
}

type Options = {
  node: Node
  dragHandlers: DragHandlers
  handlePointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerEnter?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave?: (event: PointerEvent<HTMLDivElement>) => void
  containerRef?: Ref<HTMLDivElement>
}

export type NodePresentation = {
  rect: Rect
  definition?: NodeDefinition
  selected: boolean
  hovered: boolean
  canRotate: boolean
  containerProps: NodeContainerProps
  renderProps: NodeRenderProps
  content: ReactNode
}

export const useNodePresentation = ({
  node,
  dragHandlers,
  handlePointerDown,
  onPointerEnter,
  onPointerLeave,
  containerRef
}: Options): NodePresentation => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const viewport = useViewportStore()
  const { nodeSize } = useWhiteboardConfig()
  const selection = useAtomValue(selectionAtom)
  const groupRuntime = useGroupRuntime()
  const definition = registry.get(node.type)
  const rect = useMemo(() => getNodeRect(node, nodeSize), [node, nodeSize])
  const hovered = groupRuntime.hoveredGroupId === node.id
  const tool = (selection.tool as 'select' | 'edge') ?? 'select'
  const selected = tool === 'edge' ? false : selection.selectedNodeIds.has(node.id)
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
  const core: Core = instance.core
  const zoom = viewport.zoom

  const nodeStyle = useMemo(
    () =>
      getNodeDefinitionStyle(definition, {
        core,
        node,
        rect,
        selected,
        hovered,
        zoom
      }),
    [core, definition, hovered, node, rect, selected, zoom]
  )

  const rotationStyle = useMemo<CSSProperties | undefined>(() => {
    if (typeof node.rotation !== 'number' || node.rotation === 0) return undefined
    return {
      transform: `rotate(${node.rotation}deg)`,
      transformOrigin: 'center center'
    }
  }, [node.rotation])

  const containerProps = useMemo<NodeContainerProps>(
    () => ({
      rect,
      nodeId: node.id,
      selected,
      ref: containerRef,
      style: buildContainerStyle(rect, nodeStyle, rotationStyle),
      onPointerDown: handlePointerDown,
      onPointerMove: dragHandlers.onPointerMove,
      onPointerUp: dragHandlers.onPointerUp,
      onPointerEnter,
      onPointerLeave
    }),
    [
      containerRef,
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

  return {
    rect,
    definition,
    selected,
    hovered,
    canRotate,
    containerProps,
    renderProps,
    content
  }
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
