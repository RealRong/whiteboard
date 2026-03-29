import type { Editor } from '../editor/types'
import { createClipboardCommands } from './clipboard'
import { createDrawCommands } from './draw'
import { createFrameCommands } from './frame'
import { createHistoryCommands } from './history'
import { createInsertCommands } from './insert'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import {
  type EditorCommandHost,
  type EditorCommandRuntime
} from './runtime'
import { createSelectionCommands } from './selection'
import { createToolCommands } from './tool'

export { createEditorCommandRuntime } from './runtime'

export const createEditorCommands = ({
  runtime
}: {
  runtime: EditorCommandRuntime
}): Editor['commands'] => {
  let commands!: Editor['commands']
  const contextCommands: Editor['commands']['context'] = {
    open: () => false,
    dismiss: () => undefined
  }
  const commandHost: EditorCommandHost = {
    get commands() {
      return commands
    },
    read: runtime.document.read,
    state: runtime.document.state,
    viewport: runtime.document.viewport.read
  }

  const historyCommands = createHistoryCommands({
    engine: runtime.document.engine,
    history: runtime.document.history
  })
  const selectionCommands = createSelectionCommands({
    engine: runtime.document.engine,
    edit: runtime.selection.edit,
    selection: runtime.selection.selection,
    frame: runtime.selection.frame
  })
  const frameCommands = createFrameCommands({
    frame: runtime.selection.frame,
    selection: selectionCommands
  })
  const toolCommands = createToolCommands({
    tool: runtime.tool.tool,
    edit: runtime.selection.edit,
    selection: runtime.selection.selection.commands
  })
  const drawCommands = createDrawCommands({
    tool: runtime.tool.tool,
    draw: runtime.draw.draw
  })
  const nodeCommands = createNodeCommands({
    engine: runtime.document.engine,
    read: runtime.document.read,
    runtime: runtime.node.runtime,
    edit: runtime.selection.edit,
    selection: selectionCommands
  })
  const mindmapCommands = createMindmapCommands({
    engine: runtime.document.engine,
    commandHost
  })
  const clipboardCommands = createClipboardCommands({
    commandHost,
    runtime: runtime.clipboard.runtime,
    port: runtime.clipboard.port,
    readPointerWorld: runtime.clipboard.readPointerWorld
  })
  const insertCommands = createInsertCommands({
    commandHost
  })

  commands = {
    ...runtime.document.engine.commands,
    history: historyCommands,
    tool: toolCommands,
    draw: drawCommands,
    edit: runtime.selection.edit,
    selection: selectionCommands,
    frame: frameCommands,
    viewport: runtime.document.viewport.commands,
    edge: runtime.document.engine.commands.edge,
    node: nodeCommands,
    mindmap: mindmapCommands,
    context: contextCommands,
    clipboard: clipboardCommands,
    insert: insertCommands
  }

  return commands
}
