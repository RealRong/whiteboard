import type { PrimitiveAtom } from 'jotai/vanilla'
import type { Document } from '@whiteboard/core/types'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Scheduler } from '../../Scheduler'
import { createEdgeCommands, type EdgeCommandsApi } from '../commands/edge'
import { createInteractionCommands, type InteractionCommandsApi } from '../commands/interaction'
import { createMindmapCommands, type MindmapCommandsApi } from '../commands/mindmap'
import { createNodeCommands, type NodeCommandsApi } from '../commands/node'
import { createShortcutActionDispatcher, type ShortcutActionDispatcher } from '../commands/shortcut'
import { createSelectionCommands, type SelectionCommandsApi } from '../commands/selection'
import { createViewportCommands, type ViewportCommandsApi } from '../commands/viewport'
import { HistoryDomain } from '../history/HistoryDomain'
import { MutationExecutor } from '../pipeline/MutationExecutor'
import { createChangeBus, type ChangeBus } from '../pipeline/ChangeBus'
import { WriteCoordinator } from '../pipeline/WriteCoordinator'

export type WriteRuntimeCommands = {
  edge: EdgeCommandsApi
  interaction: InteractionCommandsApi
  viewport: ViewportCommandsApi
  node: NodeCommandsApi
  mindmap: MindmapCommandsApi
  selection: SelectionCommandsApi
  shortcut: ShortcutActionDispatcher
}

export type WriteRuntime = {
  mutate: InternalInstance['mutate']
  history: Commands['history']
  resetDoc: Commands['doc']['reset']
  changeBus: ChangeBus
  commands: WriteRuntimeCommands
}

type CreateWriteRuntimeOptions = {
  instance: InternalInstance
  scheduler: Scheduler
  documentAtom: PrimitiveAtom<Document>
  readModelRevisionAtom: PrimitiveAtom<number>
}

export const createWriteRuntime = ({
  instance,
  scheduler,
  documentAtom,
  readModelRevisionAtom
}: CreateWriteRuntimeOptions): WriteRuntime => {
  const changeBus = createChangeBus()
  const mutationExecutor = new MutationExecutor({
    instance,
    changeBus,
    documentAtom,
    readModelRevisionAtom,
    now: scheduler.now
  })
  const historyDomain = new HistoryDomain({
    now: scheduler.now
  })
  const writeCoordinator = new WriteCoordinator({
    executor: mutationExecutor,
    history: historyDomain
  })

  const edge = createEdgeCommands({ instance })
  const interaction = createInteractionCommands({ instance })
  const viewport = createViewportCommands({ instance })
  const node = createNodeCommands({ instance })
  const mindmap = createMindmapCommands({ instance })
  const selection = createSelectionCommands({ instance })
  const shortcut = createShortcutActionDispatcher({
    selection,
    history: writeCoordinator.history
  })

  return {
    mutate: writeCoordinator.applyMutations,
    history: writeCoordinator.history,
    resetDoc: writeCoordinator.resetDocument,
    changeBus,
    commands: {
      edge,
      interaction,
      viewport,
      node,
      mindmap,
      selection,
      shortcut
    }
  }
}
