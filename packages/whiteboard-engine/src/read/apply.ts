import type {
  EdgeReadProjection,
  MindmapReadProjection,
  NodeReadProjection,
  ReadModel
} from '@engine-types/read'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import { NodeRectIndex } from './indexes'
import { SnapIndex } from './indexes'

export const createReadApply = ({
  readModel,
  nodeRectIndex,
  snapIndex,
  nodeProjection,
  edgeProjection,
  mindmapProjection
}: {
  readModel: () => ReadModel
  nodeRectIndex: NodeRectIndex
  snapIndex: SnapIndex
  nodeProjection: NodeReadProjection
  edgeProjection: EdgeReadProjection
  mindmapProjection: MindmapReadProjection
}) => (impact: KernelReadImpact) => {
  const model = readModel()
  nodeRectIndex.applyChange(impact, model)
  snapIndex.applyChange(impact, nodeRectIndex)

  nodeProjection.applyChange(impact)
  edgeProjection.applyChange(impact)
  mindmapProjection.applyChange(impact)
}
