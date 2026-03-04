import {
  READ_STATE_KEYS,
  type EngineRead
} from '@engine-types/instance/read'
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
  const state: EngineRead['state'] = {
    get interaction() {
      return context.get(READ_STATE_KEYS.interaction)
    },
    get tool() {
      return context.get(READ_STATE_KEYS.tool)
    },
    get selection() {
      return context.get(READ_STATE_KEYS.selection)
    },
    get viewport() {
      return context.get(READ_STATE_KEYS.viewport)
    },
    get mindmapLayout() {
      return context.get(READ_STATE_KEYS.mindmapLayout)
    }
  }

  const projection: EngineRead['projection'] = {
    get viewportTransform() {
      return node.get.viewportTransform()
    },
    get node() {
      return node.get.node()
    },
    get edge() {
      return edge.get.edge()
    },
    get mindmap() {
      return mindmap.get.mindmap()
    }
  }

  return {
    state,
    projection,
    subscribe: context.subscribe
  }
}
