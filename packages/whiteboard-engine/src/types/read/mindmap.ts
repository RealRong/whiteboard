import type {
  MindmapView
} from '../instance/read'

export type MindmapReadSnapshot = MindmapView

export type MindmapReadCache = {
  getSnapshot: () => MindmapReadSnapshot
}

export type MindmapRead = {
  get: {
    mindmap: () => MindmapView
  }
}
