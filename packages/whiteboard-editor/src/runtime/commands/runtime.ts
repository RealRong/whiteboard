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
import type {
  EditorCommandDocumentRuntime,
  EditorCommandDrawRuntime,
  EditorCommandNodeRuntime,
  EditorCommandRuntime,
  EditorCommandSelectionRuntime,
  EditorCommandToolRuntime
} from '../../types/internal/editor'

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

export type {
  EditorCommandClipboardRuntime,
  EditorCommandDocumentRuntime,
  EditorCommandDrawRuntime,
  EditorCommandHost,
  EditorCommandNodeRuntime,
  EditorCommandRuntime,
  EditorCommandSelectionRuntime,
  EditorCommandToolRuntime
} from '../../types/internal/editor'
