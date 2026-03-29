import type { EditorRuntime as EditorBaseRuntime } from '@whiteboard/editor/runtime/editor/types'
import type { NodeRegistry } from './node'

export type WhiteboardRuntime = Omit<EditorBaseRuntime, 'host'> & {
  host: EditorBaseRuntime['host'] & {
    registry: NodeRegistry
  }
}

export type WhiteboardInstance = WhiteboardRuntime
