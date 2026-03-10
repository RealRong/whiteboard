import type { Commands } from '@engine-types/command'
import type { Write } from '@engine-types/write'
import { edge } from './edge'
import { mindmap } from './mindmap'
import { node } from './node'

export const createCommands = ({
  write
}: {
  write: Write
}): Commands => {
  return {
    document: {
      replace: write.replace
    },
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
