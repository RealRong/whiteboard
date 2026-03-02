import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import { edge } from './commands/edge'
import { interaction } from './commands/interaction'
import { mindmap } from './commands/mindmap'
import { node } from './commands/node'
import { shortcut } from './commands/shortcut'
import { selection } from './commands/selection'
import { viewport } from './commands/viewport'
import { Writer } from './pipeline/Writer'
import { bus } from './pipeline/ChangeBus'

export const runtime = ({
  instance,
  scheduler,
  documentAtom,
  readModelRevisionAtom
}: WriteDeps): WriteRuntime => {
  const changeBus = bus()
  const writer = new Writer({
    instance,
    changeBus,
    documentAtom,
    readModelRevisionAtom,
    now: scheduler.now
  })
  const commands = {
    edge: edge({ instance }),
    interaction: interaction({ instance }),
    viewport: viewport({ instance }),
    node: node({ instance }),
    mindmap: mindmap({ instance }),
    selection: selection({ instance })
  }
  const hotkeys = shortcut({
    selection: commands.selection,
    history: writer.history
  })

  return {
    mutate: writer.mutate,
    history: writer.history,
    resetDoc: writer.resetDoc,
    changeBus,
    commands: {
      ...commands,
      shortcut: hotkeys
    }
  }
}
