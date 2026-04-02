import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types'
import { createDrawCommands } from './draw'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import type {
  EditorCommandHost
} from '../types'
import type { EditorOverlay } from '../../transient'
import type { RuntimeStateController } from '../../local/state'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'
import type { InsertPresetCatalog } from '../../../features/toolbox/model/insert'

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
}): Omit<Editor['commands'], 'clipboard'> => {
  let commands!: Omit<Editor['commands'], 'clipboard'>
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
  const viewportCommands = {
    ...runtime.state.viewport.commands,
    panScreenBy: runtime.state.viewport.input.panScreenBy,
    wheel: (
      input: Parameters<Editor['commands']['viewport']['wheel']>[0],
      wheelSensitivity: Parameters<Editor['commands']['viewport']['wheel']>[1]
    ) => {
      runtime.state.viewport.input.wheel({
        deltaX: input.deltaX,
        deltaY: input.deltaY,
        clientX: input.client.x,
        clientY: input.client.y,
        ctrlKey: input.modifiers.ctrl,
        metaKey: input.modifiers.meta
      }, wheelSensitivity)
    },
    setRect: runtime.state.viewport.setRect,
    setLimits: runtime.state.viewport.setLimits
  }

  commands = {
    ...engine.commands,
    history: historyCommands,
    tool: toolCommands,
    draw: drawCommands,
    edit: runtime.state.edit.mutate,
    selection: selectionCommands,
    viewport: viewportCommands,
    edge: engine.commands.edge,
    node: nodeCommands,
    mindmap: mindmapCommands,
    insert: insertCommands
  }

  return commands
}
