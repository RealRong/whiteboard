import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeHistory } from '@engine-types/instance/runtime'
import type { DispatchResult, Document } from '@whiteboard/core/types'
import type { Actor as EdgeActor } from '../../runtime/actors/edge/Actor'
import type { Actor as MindmapActor } from '../../runtime/actors/mindmap/Actor'
import type { Actor as NodeActor } from '../../runtime/actors/node/Actor'
import type { Domain as ViewportDomainActor } from '../../runtime/actors/viewport/Domain'
import { createBase } from './base'
import { createEdge } from './edge'
import { createGroup } from './group'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createOrder } from './order'
import { createSelection } from './selection'
import { createViewport } from './viewport'

type CommandContext = {
  instance: InternalInstance
}

type CreateCommandsOptions = CommandContext & {
  history: RuntimeHistory
  resetDoc: (doc: Document) => Promise<DispatchResult>
  edge: EdgeActor
  mindmap: MindmapActor
  node: NodeActor
  viewport: ViewportDomainActor
}

export const createCommands = ({
  instance,
  history,
  resetDoc,
  edge,
  mindmap,
  node,
  viewport
}: CreateCommandsOptions): Commands => {
  const selection = createSelection(instance)

  return {
    ...createBase(instance, history, resetDoc),
    selection,
    ...createEdge(edge),
    ...createNode(node),
    order: createOrder(node, edge),
    viewport: createViewport(viewport),
    group: createGroup(node),
    ...createMindmap(mindmap)
  }
}
