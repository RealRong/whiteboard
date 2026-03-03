import type { Runtime as WriteRuntime } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import type {
  WriteDomain,
  WriteInput
} from '@engine-types/command/api'
import type { CommandGateway } from '@engine-types/cqrs/command'
import {
  applyWrite as applyWriteApi,
  edge,
  interaction,
  mindmap,
  node,
  shortcut,
  selection,
  viewport
} from './api'
import { Writer } from './stages/commit/writer'
import { bus } from './stages/invalidation/changeBus'
import { plan } from './stages/plan/router'
import { createCommandGateway } from '../command'
import {
  type Apply,
  type PlanInput
} from './stages/plan/draft'

const toPlanInput = <D extends WriteDomain>(payload: WriteInput<D>): PlanInput<D> => ({
  domain: payload.domain,
  command: payload.command
} as PlanInput<D>)

type BaseCommandSet = Pick<
  WriteRuntime['commands'],
  'edge' | 'interaction' | 'viewport' | 'node' | 'mindmap'
>
type DerivedCommandSet = Pick<
  WriteRuntime['commands'],
  'selection' | 'shortcut'
>
type BaseCommandBuilderDeps = {
  instance: WriteDeps['instance']
  apply: Apply
}
type DerivedCommandBuilderDeps = {
  instance: WriteDeps['instance']
  baseCommands: BaseCommandSet
  history: WriteRuntime['history']
}

const baseCommandBuilders: {
  [K in keyof BaseCommandSet]: (deps: BaseCommandBuilderDeps) => BaseCommandSet[K]
} = {
  edge: ({ instance, apply }) => edge({ instance, apply }),
  interaction: ({ instance }) => interaction({ instance }),
  viewport: ({ apply }) => viewport({ apply }),
  node: ({ instance, apply }) => node({ instance, apply }),
  mindmap: ({ apply }) => mindmap({ apply })
}

const createBaseCommandSet = (deps: BaseCommandBuilderDeps): BaseCommandSet => ({
  edge: baseCommandBuilders.edge(deps),
  interaction: baseCommandBuilders.interaction(deps),
  viewport: baseCommandBuilders.viewport(deps),
  node: baseCommandBuilders.node(deps),
  mindmap: baseCommandBuilders.mindmap(deps)
})

const createDerivedCommandSet = ({
  instance,
  baseCommands,
  history
}: DerivedCommandBuilderDeps): DerivedCommandSet => {
  const selectionCommands = selection({
    instance,
    commands: {
      node: baseCommands.node,
      edge: baseCommands.edge
    }
  })

  return {
    selection: selectionCommands,
    shortcut: shortcut({
      selection: selectionCommands,
      history
    })
  }
}

const createWritePipeline = ({
  instance,
  scheduler,
  readModelRevisionAtom
}: WriteDeps): {
  changeBus: ReturnType<typeof bus>
  writer: Writer
  apply: Apply
  gateway: CommandGateway
} => {
  const changeBus = bus()
  const writer = new Writer({
    instance,
    changeBus,
    readModelRevisionAtom,
    now: scheduler.now
  })
  const planner = plan({ instance })
  const apply: Apply = (payload) =>
    writer.applyDraft(
      planner(toPlanInput(payload)),
      payload.source ?? 'ui',
      payload.trace
    )
  const gateway = createCommandGateway({ apply })

  return {
    changeBus,
    writer,
    apply,
    gateway
  }
}

const createWriteCommandSet = ({
  instance,
  apply,
  history
}: {
  instance: WriteDeps['instance']
  apply: Apply
  history: WriteRuntime['history']
}): WriteRuntime['commands'] => {
  const baseCommands = createBaseCommandSet({
    instance,
    apply
  })
  const derivedCommands = createDerivedCommandSet({
    instance,
    baseCommands,
    history
  })

  return {
    ...baseCommands,
    ...derivedCommands
  }
}

export const runtime = ({
  instance,
  scheduler,
  readModelRevisionAtom
}: WriteDeps): WriteRuntime => {
  const {
    changeBus,
    writer,
    apply,
    gateway
  } = createWritePipeline({
    instance,
    scheduler,
    readModelRevisionAtom
  })
  const commands = createWriteCommandSet({
    instance,
    apply,
    history: writer.history
  })
  const applyWrite = applyWriteApi({ gateway })

  return {
    gateway,
    applyWrite,
    history: writer.history,
    resetDoc: writer.resetDoc,
    changeBus,
    commands
  }
}
