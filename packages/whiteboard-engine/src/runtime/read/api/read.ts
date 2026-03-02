import type { EngineRead, ReadPublicKey } from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { EdgeReadRuntime } from '@engine-types/read/edge'
import type { MindmapReadRuntime } from '@engine-types/read/mindmap'
import type { NodeReadRuntime } from '@engine-types/read/node'

type ReadApiDeps = {
  context: ReadRuntimeContext
  node: NodeReadRuntime
  edge: EdgeReadRuntime
  mindmap: MindmapReadRuntime
}

export const readApi = ({
  context,
  node,
  edge,
  mindmap
}: ReadApiDeps): EngineRead => {
  const get: EngineRead['get'] = Object.assign(
    <K extends ReadPublicKey>(key: K) => context.get(key),
    node.get,
    edge.get,
    mindmap.get
  )

  return {
    get,
    subscribe: context.subscribe
  }
}
