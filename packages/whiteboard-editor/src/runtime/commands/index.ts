import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import type { ViewportCommands } from '../viewport'
import { createDrawCommands } from './draw'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import type {
  EditorCommandHost
} from '../editor/types'
import type { DrawPreferencesRuntime } from '../../features/draw/preferences'
import type { SelectionState } from '../state/selection'
import type { EditMutate } from '../state/edit'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'
import type { NodeTransientRuntime } from '../transient/node'
import type { InsertPresetCatalog } from '../../types/insert'

export const createEditorCommands = ({
  engine,
  read,
  tool,
  edit,
  selection,
  viewportCommands,
  drawPreferences,
  nodeTransient,
  insertPresetCatalog
}: {
  engine: EngineInstance
  read: Editor['read']
  tool: {
    get: () => ReturnType<Editor['state']['tool']['get']>
    set: (tool: ReturnType<Editor['state']['tool']['get']>) => void
  }
  edit: EditMutate
  selection: SelectionState
  viewportCommands: ViewportCommands
  drawPreferences: DrawPreferencesRuntime
  nodeTransient: NodeTransientRuntime
  insertPresetCatalog: InsertPresetCatalog
}): Editor['commands'] => {
  let commands!: Editor['commands']
  const commandHost: EditorCommandHost = {
    get commands() {
      return commands
    },
    read
  }

  const historyCommands = createHistoryCommands({
    engine
  })
  const selectionCommands = createSelectionCommands({
    engine,
    edit,
    selection
  })
  const toolCommands = createToolCommands({
    tool,
    edit,
    selection: selection.mutate
  })
  const drawCommands = createDrawCommands({
    tool,
    drawPreferences
  })
  const nodeCommands = createNodeCommands({
    engine,
    read,
    runtime: nodeTransient,
    edit,
    selection: selectionCommands
  })
  const mindmapCommands = createMindmapCommands({
    engine,
    commandHost
  })
  const insertCommands = createInsertCommands({
    commandHost,
    catalog: insertPresetCatalog
  })

  commands = {
    ...engine.commands,
    history: historyCommands,
    tool: toolCommands,
    draw: drawCommands,
    edit,
    selection: selectionCommands,
    viewport: viewportCommands,
    edge: engine.commands.edge,
    node: nodeCommands,
    mindmap: mindmapCommands,
    insert: insertCommands
  }

  return commands
}
