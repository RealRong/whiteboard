import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Core, Rect } from '@whiteboard/core'
import type { NodeContainerProps, NodePresentation, UseNodePresentationOptions, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import { getNodeRect } from '../../common/utils/geometry'
import { useNodeSelectionFlags } from './useNodeSelectionFlags'

export const useNodePresentation = ({
  node,
  containerRef
}: UseNodePresentationOptions): NodePresentation => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const zoom = useWhiteboardSelector((snapshot) => snapshot.viewport.zoom, {
    keys: ['viewport'],
    equality: Object.is
  })
  const { nodeSize } = instance.runtime.config
  const { selected, hovered, activeTool } = useNodeSelectionFlags(node.id)

  const definition = useMemo(() => registry.get(node.type), [node.type, registry])
  const rect = useMemo(() => getNodeRect(node, nodeSize), [node, nodeSize])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
  const core: Core = instance.runtime.core
  const nodeStyle = useMemo(
    () =>
      getNodeDefinitionStyle(definition, {
        core,
        commands: instance.commands,
        node,
        rect,
        selected,
        hovered,
        zoom
      }),
    [core, definition, hovered, instance.commands, node, rect, selected, zoom]
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
      style: buildContainerStyle(rect, nodeStyle, rotationStyle)
    }),
    [containerRef, node.id, nodeStyle, rect, rotationStyle, selected]
  )

  const renderProps = useMemo<NodeRenderProps>(
    () => ({
      core,
      commands: instance.commands,
      node,
      rect,
      selected,
      hovered,
      zoom,
      containerProps
    }),
    [containerProps, core, hovered, instance.commands, node, rect, selected, zoom]
  )

  return {
    rect,
    definition,
    activeTool,
    selected,
    hovered,
    canRotate,
    containerProps,
    renderProps
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
