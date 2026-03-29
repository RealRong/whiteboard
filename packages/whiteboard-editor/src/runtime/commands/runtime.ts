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

export type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export type EditorCommandDocumentRuntime = {
  engine: EngineInstance
  read: Editor['read']
  state: Editor['state']
  history: {
    set: (value: HistoryState) => void
  }
  viewport: {
    commands: ViewportCommands
    read: Editor['viewport']
  }
}

export type EditorCommandSelectionRuntime = {
  edit: ReturnType<typeof createEditState>['commands']
  selection: ReturnType<typeof createSelectionState>
  frame: ReturnType<typeof createFrameState>
}

export type EditorCommandToolRuntime = {
  tool: {
    get: () => Tool
    set: (tool: Tool) => void
  }
}

export type EditorCommandDrawRuntime = {
  draw: ReturnType<typeof createDrawState>
}

export type EditorCommandNodeRuntime = {
  runtime: NodeFeatureRuntime
}

export type EditorCommandClipboardRuntime = {
  runtime: ClipboardRuntime
  port: ClipboardPort
  readPointerWorld: () => Point | undefined
}

export type EditorCommandRuntime = {
  document: EditorCommandDocumentRuntime
  selection: EditorCommandSelectionRuntime
  tool: EditorCommandToolRuntime
  draw: EditorCommandDrawRuntime
  node: EditorCommandNodeRuntime
  clipboard: EditorCommandClipboardRuntime
}

export const createEditorCommandRuntime = ({
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
  clipboardRuntime,
  clipboardPort,
  readPointerWorld
}: {
  engine: EngineInstance
  read: Editor['read']
  state: Editor['state']
  tool: EditorCommandToolRuntime['tool']
  history: EditorCommandDocumentRuntime['history']
  edit: EditorCommandSelectionRuntime['edit']
  selection: EditorCommandSelectionRuntime['selection']
  frame: EditorCommandSelectionRuntime['frame']
  viewportCommands: ViewportCommands
  viewportRead: Editor['viewport']
  draw: EditorCommandDrawRuntime['draw']
  nodeRuntime: EditorCommandNodeRuntime['runtime']
  clipboardRuntime: ClipboardRuntime
  clipboardPort: ClipboardPort
  readPointerWorld: () => Point | undefined
}): EditorCommandRuntime => ({
  document: {
    engine,
    read,
    state,
    history,
    viewport: {
      commands: viewportCommands,
      read: viewportRead
    }
  },
  selection: {
    edit,
    selection,
    frame
  },
  tool: {
    tool
  },
  draw: {
    draw
  },
  node: {
    runtime: nodeRuntime
  },
  clipboard: {
    runtime: clipboardRuntime,
    port: clipboardPort,
    readPointerWorld
  }
})
