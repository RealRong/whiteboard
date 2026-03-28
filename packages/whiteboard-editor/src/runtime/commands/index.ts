import type { HistoryState } from '@whiteboard/core/kernel'
import type { Point } from '@whiteboard/core/types'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../editor/types'
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
import type { NodeFeatureRuntime } from '../../features/node/session/node'
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
  nodeRuntime,
  input,
  context,
  clipboardRuntime,
  clipboardPort,
  readPointerWorld
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
  nodeRuntime: NodeFeatureRuntime
  input: Editor['commands']['input']
  context: Editor['commands']['context']
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
  readPointerWorld: () => Point | undefined
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
    engine,
    read,
    runtime: nodeRuntime,
    edit,
    selection: selectionCommands
  })
  const mindmapCommands = createMindmapCommands({
    engine,
    commandHost
  })
  const clipboardCommands = createClipboardCommands({
    commandHost,
    runtime: clipboardRuntime,
    port: clipboardPort,
    readPointerWorld
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
    input,
    context,
    clipboard: clipboardCommands,
    insert: insertCommands
  }

  return commands
}
