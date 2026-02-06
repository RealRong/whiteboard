import type { MindmapLayoutConfig } from '../types'
import { MindmapLayer } from './MindmapLayer'
import { useDoc, useInstance, useWhiteboardConfig } from '../../common/hooks'

type MindmapLayerStackProps = {
  layout: MindmapLayoutConfig
}

export const MindmapLayerStack = ({ layout }: MindmapLayerStackProps) => {
  const doc = useDoc()
  const instance = useInstance()
  const { mindmapNodeSize: nodeSize } = useWhiteboardConfig()

  if (!doc) return null

  return (
    <MindmapLayer
      nodes={doc.nodes}
      nodeSize={nodeSize}
      layout={layout}
      core={instance.core}
      screenToWorld={instance.viewport.screenToWorld}
      containerRef={instance.containerRef}
    />
  )
}
