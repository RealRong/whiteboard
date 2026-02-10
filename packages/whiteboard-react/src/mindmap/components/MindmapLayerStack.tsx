import type { MindmapLayoutConfig } from 'types/mindmap'
import { MindmapLayer } from './MindmapLayer'
import { useDoc, useInstance } from '../../common/hooks'

type MindmapLayerStackProps = {
  layout: MindmapLayoutConfig
}

export const MindmapLayerStack = ({ layout }: MindmapLayerStackProps) => {
  const doc = useDoc()
  const instance = useInstance()
  const { mindmapNodeSize: nodeSize } = instance.runtime.config

  if (!doc) return null

  return (
    <MindmapLayer
      nodes={doc.nodes}
      nodeSize={nodeSize}
      layout={layout}
      core={instance.runtime.core}
    />
  )
}
