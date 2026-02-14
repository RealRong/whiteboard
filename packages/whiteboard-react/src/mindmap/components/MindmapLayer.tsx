import { useMemo } from 'react'
import type { Node } from '@whiteboard/core'
import type { MindmapLayoutConfig } from 'types/mindmap'
import type { Size } from 'types/common'
import { MindmapTreeView } from './MindmapTreeView'
import { getMindmapTree } from '../utils/mindmapTree'

type MindmapLayerProps = {
  nodes: Node[]
  nodeSize: Size
  layout: MindmapLayoutConfig
}

export const MindmapLayer = ({ nodes, nodeSize, layout }: MindmapLayerProps) => {
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
          />
        )
      })}
    </>
  )
}
