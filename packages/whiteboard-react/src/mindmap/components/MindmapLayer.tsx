import { useMemo } from 'react'
import type { RefObject } from 'react'
import type { Core, Node, Point } from '@whiteboard/core'
import type { MindmapLayoutConfig } from '../types'
import type { Size } from '../../common/types'
import { MindmapTreeView } from './MindmapTreeView'
import { getMindmapTree } from '../utils/mindmapTree'

type MindmapLayerProps = {
  nodes: Node[]
  nodeSize: Size
  layout: MindmapLayoutConfig
  core: Core
  screenToWorld: (point: Point) => Point
  containerRef?: RefObject<HTMLElement | null>
}

export const MindmapLayer = ({ nodes, nodeSize, layout, core, screenToWorld, containerRef }: MindmapLayerProps) => {
  const mindmapNodes = useMemo(() => nodes.filter((node) => node.type === 'mindmap'), [nodes])
  if (!mindmapNodes.length) return null
  return (
    <>
      {mindmapNodes.map((node) => {
        const tree = getMindmapTree(node)
        if (!tree) return null
        return (
          <MindmapTreeView
            key={node.id}
            tree={tree}
            mindmapNode={node}
            nodeSize={nodeSize}
            layout={layout}
            core={core}
            screenToWorld={screenToWorld}
            containerRef={containerRef}
          />
        )
      })}
    </>
  )
}
