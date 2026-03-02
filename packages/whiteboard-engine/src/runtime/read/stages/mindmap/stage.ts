import type { ReadRuntimeContext } from '@engine-types/read/context'
import type { MindmapReadRuntime } from '@engine-types/read/mindmap'
import { cache } from './cache'

export const mindmap = (context: ReadRuntimeContext): MindmapReadRuntime => {
  const memo = cache(context)

  return {
    get: {
      mindmapIds: () => memo.getSnapshot().ids,
      mindmapById: (id) => memo.getSnapshot().byId.get(id)
    }
  }
}
