import type { ReadContext } from '@engine-types/read/context'
import type { MindmapRead } from '@engine-types/read/mindmap'
import { cache } from './cache'

export const mindmap = (context: ReadContext): MindmapRead => {
  const memo = cache(context)

  return {
    get: {
      mindmap: () => memo.getSnapshot()
    }
  }
}
