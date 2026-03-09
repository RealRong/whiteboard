import type { Commands } from '@engine-types/command'
import type { Write } from '@engine-types/write'
import type { Document } from '@whiteboard/core/types'
import { edge } from './edge'
import { mindmap } from './mindmap'
import { node } from './node'
import { viewport } from './viewport'

export const createCommands = ({
  document,
  write
}: {
  document: {
    get: () => Document
  }
  write: Write
}): Commands => {
  return {
    doc: {
      load: write.load,
      replace: write.replace
    },
    history: write.history,
    edge: edge({
      document,
      apply: write.apply
    }),
    viewport: viewport({
      apply: write.apply
    }),
    node: node({
      document,
      apply: write.apply
    }),
    mindmap: mindmap({
      apply: write.apply
    })
  }
}
