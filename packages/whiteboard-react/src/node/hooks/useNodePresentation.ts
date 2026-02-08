import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import type { Core, Rect } from '@whiteboard/core'
import type { NodeContainerProps, NodePresentation, UseNodePresentationOptions, NodeRenderProps } from 'types/node'
import { getNodeDefinitionStyle } from '../registry/defaultNodes'
import { useNodeRegistry } from '../registry'
import { useInstance, useWhiteboardConfig } from '../../common/hooks'
import { getNodeRect } from '../../common/utils/geometry'
import { useNodeSelectionFlags } from './useNodeSelectionFlags'


export const useNodePresentation = ({
  node,
  containerRef
}: UseNodePresentationOptions): NodePresentation => {
  const instance = useInstance()
  const registry = useNodeRegistry()
  const zoom = instance.runtime.viewport.getZoom()
  const { nodeSize } = useWhiteboardConfig()
  const { selected, hovered } = useNodeSelectionFlags(node.id)

  const definition = registry.get(node.type)
  const rect = useMemo(() => getNodeRect(node, nodeSize), [node, nodeSize])
  const canRotate =
    typeof definition?.canRotate === 'boolean' ? definition.canRotate : node.type !== 'group'
  const core: Core = instance.runtime.core
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
      style: buildContainerStyle(rect, nodeStyle, rotationStyle)
    }),
    [containerRef, node.id, nodeStyle, rect, rotationStyle, selected]
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

  return {
    rect,
    definition,
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
