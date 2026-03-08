import type { MindmapView } from '../../instance/read'

export type MindmapReadProjection = {
  getView: () => MindmapView
}
