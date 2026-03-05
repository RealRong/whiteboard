import { type EngineRead } from '@engine-types/instance/read'
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
      return context.state.interaction()
    },
    get tool() {
      return context.state.tool()
    },
    get selection() {
      return context.state.selection()
    },
    get viewport() {
      return context.state.viewport()
    },
    get mindmapLayout() {
      return context.state.mindmapLayout()
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
