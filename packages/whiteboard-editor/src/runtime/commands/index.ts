import type { HistoryState } from '@whiteboard/core/kernel'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../instance/types'
import type { Tool } from '../tool'
import type { ViewportCommands } from '../viewport'
import {
  createState as createEditState
} from '../edit'
import {
  createState as createFrameState
} from '../frame'
import {
  createState as createSelectionState
} from '../selection'
import { createDrawState } from '../../features/draw/state'
import type {
  ClipboardPort,
  ClipboardRuntime
} from '../host/clipboard'
import { createClipboardCommands } from './clipboard'
import { createDrawCommands } from './draw'
import { createFrameCommands } from './frame'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'

type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export const createEditorCommands = ({
  engine,
  read,
  state,
  tool,
  history,
  edit,
  selection,
  frame,
  viewportCommands,
  viewportRead,
  draw,
  clipboardRuntime,
  clipboardPort
}: {
  engine: EngineInstance
  read: Editor['read']
  state: Editor['state']
  tool: {
    get: () => Tool
    set: (tool: Tool) => void
  }
  history: {
    set: (value: HistoryState) => void
  }
  edit: ReturnType<typeof createEditState>['commands']
  selection: ReturnType<typeof createSelectionState>
  frame: ReturnType<typeof createFrameState>
  viewportCommands: ViewportCommands
  viewportRead: Editor['viewport']
  draw: ReturnType<typeof createDrawState>
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
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
    engine,
    history
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
    engine
  })
  const mindmapCommands = createMindmapCommands({
    engine,
    commandHost
  })
  const clipboardCommands = createClipboardCommands({
    commandHost,
    runtime: clipboardRuntime,
    port: clipboardPort
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
