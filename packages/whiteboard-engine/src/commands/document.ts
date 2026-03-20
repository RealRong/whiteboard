import { buildInsertSliceOperations } from '@whiteboard/core/document'
import type { Slice, SliceInsertOptions } from '@whiteboard/core/document'
import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { BoardConfig } from '@engine-types/instance'
import type { Write } from '@engine-types/write'
import type { EngineCommands } from '@engine-types/command'
import { createId } from '@whiteboard/core/utils'
import { invalid, success } from '../result'

export const document = ({
  write,
  readDocument,
  config,
  registries
}: {
  write: Write
  readDocument: () => Document
  config: BoardConfig
  registries: CoreRegistries
}): EngineCommands['document'] => ({
  apply: write.applyOperations,
  replace: write.replace,
  insert: (slice: Slice, options?: SliceInsertOptions) => {
    const planned = buildInsertSliceOperations({
      doc: readDocument(),
      slice,
      nodeSize: config.nodeSize,
      registries,
      createNodeId: () => createId('node'),
      createEdgeId: () => createId('edge'),
      at: options?.at,
      offset: options?.offset,
      parentId: options?.parentId,
      roots: options?.roots
    })
    if (!planned.ok) {
      return invalid(planned.error.message, planned.error.details)
    }

    const committed = write.applyOperations(planned.data.operations)
    if (!committed.ok) {
      return committed
    }

    return success(committed.commit, {
      roots: planned.data.roots,
      allNodeIds: planned.data.allNodeIds,
      allEdgeIds: planned.data.allEdgeIds
    })
  }
})
