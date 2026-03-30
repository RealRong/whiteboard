import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import type { ViewportCommands } from '../viewport'
import { createDrawCommands } from './draw'
import { createFrameCommands } from './frame'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import type {
  DrawFeatureState,
  EditorCommandHost
} from '../../types/internal/editor'
import type { SelectionStore } from '../../types/internal/selection'
import type { FrameState } from '../frame'
import type { EditCommands } from '../edit'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'
import type { NodeProjectionRuntime } from '../projection/node'
import type { InsertPresetCatalog } from '../../types/toolbox'

export const createEditorCommands = ({
  engine,
  read,
  state,
  tool,
  edit,
  selection,
  frame,
  viewportCommands,
  viewportRead,
  draw,
  nodeProjection,
  insertPresetCatalog
}: {
  engine: EngineInstance
  read: Editor['read']
  state: Editor['state']
  tool: {
    get: () => ReturnType<Editor['state']['tool']['get']>
    set: (tool: ReturnType<Editor['state']['tool']['get']>) => void
  }
  edit: EditCommands
  selection: SelectionStore
  frame: FrameState
  viewportCommands: ViewportCommands
  viewportRead: Editor['viewport']
  draw: DrawFeatureState
  nodeProjection: NodeProjectionRuntime
  insertPresetCatalog: InsertPresetCatalog
}): Editor['commands'] => {
  let commands!: Editor['commands']
  const commandHost: EditorCommandHost = {
    get commands() {
      return commands
    },
    read,
    state,
    viewport: viewportRead
  }

  const historyCommands = createHistoryCommands({
    engine
  })
  const selectionCommands = createSelectionCommands({
    engine,
    edit,
    selection,
    frame
  })
  const frameCommands = createFrameCommands({
    frame,
    selection: selectionCommands
  })
  const toolCommands = createToolCommands({
    tool,
    edit,
    selection: selection.commands
  })
  const drawCommands = createDrawCommands({
    tool,
    draw
  })
  const nodeCommands = createNodeCommands({
    engine,
    read,
    runtime: nodeProjection,
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
    frame: frameCommands,
    viewport: viewportCommands,
    edge: engine.commands.edge,
    node: nodeCommands,
    mindmap: mindmapCommands,
    insert: insertCommands
  }

  return commands
}
