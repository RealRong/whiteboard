import { MindmapLayer } from './MindmapLayer'
import { useWhiteboardView } from '../../common/hooks'

export const MindmapLayerStack = () => {
  const trees = useWhiteboardView('mindmap.trees')
  const drag = useWhiteboardView('mindmap.drag')
  return <MindmapLayer trees={trees} drag={drag} />
}
