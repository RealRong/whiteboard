import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../../types/editor'
import type { ViewportCommands } from '../viewport'
import { createClipboardCommands } from './clipboard'
import { createDrawCommands } from './draw'
import { createFrameCommands } from './frame'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import type {
  DrawFeatureState,
  EditorClipboardRuntime,
  EditorCommandHost
} from '../../types/internal/editor'
import type { SelectionStore } from '../../types/internal/selection'
import type { FrameState } from '../frame'
import type { EditCommands } from '../edit'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'
import type { NodeProjectionRuntime } from '../../features/node/projection/store'

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
  clipboard
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
  clipboard: EditorClipboardRuntime
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
  const clipboardCommands = createClipboardCommands({
    commandHost,
    runtime: clipboard.runtime,
    port: clipboard.port,
    readPointerWorld: clipboard.readPointerWorld
  })
  const insertCommands = createInsertCommands({
    commandHost
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
    clipboard: clipboardCommands,
    insert: insertCommands
  }

  return commands
}
