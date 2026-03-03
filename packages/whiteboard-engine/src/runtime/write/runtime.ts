import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import type {
  WriteDomain,
  WriteInput
} from '@engine-types/command/api'
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
import { createCommandGateway } from '../command'
import {
  type Apply,
  type Dispatch,
  type PlanInput
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
  const dispatch: Dispatch = (payload, source, trace) =>
    writer.applyDraft(planner(payload), source, trace)
  const apply: Apply = <D extends WriteDomain>(payload: WriteInput<D>) =>
    dispatch(
      {
        domain: payload.domain,
        command: payload.command
      } as PlanInput<D>,
      payload.source ?? 'ui',
      payload.trace
    )
  const gateway = createCommandGateway({ apply })
  const commands = {
    write: writeApi({
      apply,
      gateway,
      commandGatewayEnabled: instance.config.features.commandGatewayEnabled
    }),
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
    gateway,
    history: writer.history,
    resetDoc: writer.resetDoc,
    changeBus,
    commands: {
      ...commands,
      shortcut: hotkeys
    }
  }
}
