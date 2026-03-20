import type { EngineCommands } from '@engine-types/command'
import type { Write } from '@engine-types/write'
import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { BoardConfig } from '@engine-types/instance'
import { document } from './document'
import { edge } from './edge'
import { mindmap } from './mindmap'
import { node } from './node'

export const createCommands = ({
  write,
  readDocument,
  config,
  registries
}: {
  write: Write
  readDocument: () => Document
  config: BoardConfig
  registries: CoreRegistries
}): EngineCommands => {
  return {
    document: document({
      write,
      readDocument,
      config,
      registries
    }),
    history: write.history,
    edge: edge({
      apply: write.apply
    }),
    node: node({
      apply: write.apply
    }),
    mindmap: mindmap({
      apply: write.apply
    })
  }
}
