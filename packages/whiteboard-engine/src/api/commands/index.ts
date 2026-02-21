import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Actor as EdgeActor } from '../../runtime/actors/edge/Actor'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'
import type { ApplyCommandChange } from './shared'
import { createBase } from './base'
import { createEdge } from './edge'
import { createGroup } from './group'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createOrder } from './order'
import { createSelection } from './selection'
import { createTransient } from './transient'
import { createViewport } from './viewport'

type CommandContext = {
  instance: InternalInstance
}

type CreateCommandsOptions = CommandContext & {
  edge: EdgeActor
  node: NodeActor
  applyChange: ApplyCommandChange
}

export const createCommands = ({
  instance,
  edge,
  node,
  applyChange
}: CreateCommandsOptions): Commands => {
  const selection = createSelection(instance)
  const transient = createTransient({
    instance,
    edge,
    node
  })

  return {
    ...createBase(instance),
    selection,
    ...createEdge(instance, applyChange),
    ...createNode(instance, applyChange),
    transient,
    order: createOrder(instance, applyChange),
    viewport: createViewport(instance, applyChange),
    group: createGroup(instance, applyChange),
    ...createMindmap(instance, applyChange)
  }
}
