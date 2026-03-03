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
  readModelRevisionAtom
}: WriteDeps): WriteRuntime => {
  const changeBus = bus()
  const writer = new Writer({
    instance,
    changeBus,
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
  const writeCommands = writeApi({
    apply,
    gateway,
    commandGatewayEnabled: instance.config.features.commandGatewayEnabled
  })
  const edgeCommands = edge({ instance, apply })
  const interactionCommands = interaction({ instance })
  const viewportCommands = viewport({ apply })
  const nodeCommands = node({ instance, apply })
  const mindmapCommands = mindmap({ apply })
  const selectionCommands = selection({
    instance,
    commands: {
      group: {
        create: nodeCommands.createGroup,
        ungroup: nodeCommands.ungroup
      },
      edge: {
        create: edgeCommands.create,
        update: edgeCommands.update,
        delete: edgeCommands.delete,
        insertRoutingPoint: edgeCommands.insertRoutingPoint,
        moveRoutingPoint: edgeCommands.moveRoutingPoint,
        removeRoutingPoint: edgeCommands.removeRoutingPoint,
        resetRouting: edgeCommands.resetRouting,
        select: edgeCommands.select
      },
      node: {
        create: nodeCommands.create,
        update: nodeCommands.update,
        updateData: nodeCommands.updateData,
        updateManyPosition: nodeCommands.updateManyPosition,
        delete: nodeCommands.delete
      }
    }
  })
  const commands = {
    write: writeCommands,
    edge: edgeCommands,
    interaction: interactionCommands,
    viewport: viewportCommands,
    node: nodeCommands,
    mindmap: mindmapCommands,
    selection: selectionCommands
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
