import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import { createDrawCommands } from './draw'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import type {
  EditorCommandHost
} from '../editor/types'
import type { EditorOverlay } from '../overlay'
import type { RuntimeStateController } from '../state'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'
import type { InsertPresetCatalog } from '../../types/insert'

export const createEditorCommands = ({
  engine,
  read,
  runtime,
  overlay,
  insertPresetCatalog
}: {
  engine: EngineInstance
  read: Editor['read']
  runtime: Pick<RuntimeStateController, 'state'>
  overlay: Pick<EditorOverlay, 'set'>
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
    edit: runtime.state.edit.mutate,
    selection: runtime.state.selection
  })
  const toolCommands = createToolCommands({
    tool: runtime.state.tool,
    edit: runtime.state.edit.mutate,
    selection: runtime.state.selection.mutate
  })
  const drawCommands = createDrawCommands({
    tool: runtime.state.tool,
    drawPreferences: runtime.state.drawPreferences
  })
  const nodeCommands = createNodeCommands({
    engine,
    read,
    overlay,
    edit: runtime.state.edit.mutate,
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
    edit: runtime.state.edit.mutate,
    selection: selectionCommands,
    viewport: runtime.state.viewport.commands,
    edge: engine.commands.edge,
    node: nodeCommands,
    mindmap: mindmapCommands,
    insert: insertCommands
  }

  return commands
}
