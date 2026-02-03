import { useMemo } from 'react'
import type { Core, Node, Rect } from '@whiteboard/core'
import type { CSSProperties } from 'react'
import { getNodeDefinitionStyle } from '../registry/defaultNodes'
import type { NodeDefinition } from '../registry/nodeRegistry'

type Options = {
  core: Core
  node: Node
  rect: Rect
  selected: boolean
  hovered: boolean
  zoom: number
  definition?: NodeDefinition
}

export const useNodeStyle = ({ core, node, rect, selected, hovered, zoom, definition }: Options) => {
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

  return { nodeStyle, rotationStyle }
}
