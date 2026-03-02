import type {
  EngineReadGetters,
  MindmapView
} from '../instance/read'

export type MindmapReadSnapshot = MindmapView

export type MindmapReadCache = {
  getSnapshot: () => MindmapReadSnapshot
}

export type MindmapReadRuntime = {
  get: Pick<EngineReadGetters, 'mindmapIds' | 'mindmapById'>
}
