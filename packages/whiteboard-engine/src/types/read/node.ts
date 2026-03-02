import type { EngineReadGetters } from '../instance/read'

export type NodeReadRuntime = {
  get: Pick<EngineReadGetters, 'viewportTransform' | 'nodeIds' | 'nodeById'>
}
