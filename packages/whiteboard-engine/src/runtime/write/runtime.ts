import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import {
  edge,
  interaction,
  mindmap,
  node,
  write as writeApi,
  shortcut,
  selection,
  viewport
} from './api'
import { Writer } from './writer'
import { bus } from './bus'
import { plan } from './plan'
import {
  type Apply,
  type Dispatch,
  toDispatchInput
} from './model'

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
  const planner = plan({ instance })
  const dispatch: Dispatch = (payload, source) =>
    writer.applyDraft(planner(payload), source)
  const apply: Apply = (payload) =>
    dispatch(
      toDispatchInput(payload),
      payload.source ?? 'ui'
    )
  const commands = {
    write: writeApi({ apply }),
    edge: edge({ instance, apply }),
    interaction: interaction({ instance }),
    viewport: viewport({ apply }),
    node: node({ instance, apply }),
    mindmap: mindmap({ apply }),
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
