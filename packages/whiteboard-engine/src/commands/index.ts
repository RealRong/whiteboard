import type { Commands } from '@engine-types/command/api'
import type { Write } from '@engine-types/write/runtime'
import type { Document } from '@whiteboard/core/types'
import { edge } from './edge'
import { mindmap } from './mindmap'
import { node } from './node'
import { viewport as viewportCommands } from './viewport'

type CommandDeps = {
  document: {
    get: () => Document
  }
  write: Write
}

export const createCommands = ({
  document,
  write
}: CommandDeps): Commands => {
  const nodeCommands = node({
    document,
    apply: write.apply
  })
  const edgeCommands = edge({
    document,
    apply: write.apply
  })
  const historyCommands: Commands['history'] = {
    get: write.history.get,
    configure: write.history.configure,
    undo: write.history.undo,
    redo: write.history.redo,
    clear: write.history.clear
  }

  return {
    doc: {
      load: write.load,
      replace: write.replace
    },
    history: historyCommands,
    edge: edgeCommands,
    viewport: viewportCommands({
      apply: write.apply
    }),
    node: nodeCommands,
    mindmap: mindmap({
      apply: write.apply
    })
  }
}
