import type { PrimitiveAtom } from 'jotai/vanilla'
import type { Document } from '@whiteboard/core/types'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Scheduler } from '../../Scheduler'
import { createEdgeCommands, type EdgeCommandsApi } from '../commands/edge'
import { createInteractionCommands, type InteractionCommandsApi } from '../commands/interaction'
import { createMindmapController, type MindmapController } from '../commands/mindmap'
import { createNodeCommands, type NodeCommandsApi } from '../commands/node'
import { createShortcutActionDispatcher, type ShortcutActionDispatcher } from '../commands/shortcut'
import { createSelectionController, type SelectionController } from '../commands/selection'
import { createViewportCommands, type ViewportCommandsApi } from '../commands/viewport'
import { HistoryDomain } from '../history/HistoryDomain'
import { MutationExecutor } from '../pipeline/MutationExecutor'
import { createMutationMetaBus, type MutationMetaBus } from '../pipeline/MutationMetaBus'
import { WriteCoordinator } from '../pipeline/WriteCoordinator'

export type WriteRuntimeCommands = {
  edge: EdgeCommandsApi
  interaction: InteractionCommandsApi
  viewport: ViewportCommandsApi
  node: NodeCommandsApi
  mindmap: MindmapController
  selection: SelectionController
  shortcut: ShortcutActionDispatcher
}

export type WriteRuntime = {
  mutate: InternalInstance['mutate']
  history: Commands['history']
  resetDoc: Commands['doc']['reset']
  mutationMetaBus: MutationMetaBus
  commands: WriteRuntimeCommands
}

type CreateWriteRuntimeOptions = {
  instance: InternalInstance
  scheduler: Scheduler
  documentAtom: PrimitiveAtom<Document>
  readModelRevisionAtom: PrimitiveAtom<number>
  resetSelectionTransient?: () => void
}

export const createWriteRuntime = ({
  instance,
  scheduler,
  documentAtom,
  readModelRevisionAtom,
  resetSelectionTransient
}: CreateWriteRuntimeOptions): WriteRuntime => {
  const mutationMetaBus = createMutationMetaBus()
  const mutationExecutor = new MutationExecutor({
    instance,
    mutationMetaBus,
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
  const mindmap = createMindmapController({ instance })
  const selection = createSelectionController({
    instance,
    resetTransient: resetSelectionTransient
  })
  const shortcut = createShortcutActionDispatcher({
    selection,
    history: writeCoordinator.history
  })

  return {
    mutate: writeCoordinator.applyMutations,
    history: writeCoordinator.history,
    resetDoc: writeCoordinator.resetDocument,
    mutationMetaBus,
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
