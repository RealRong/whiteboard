import type { Editor as EditorBaseRuntime } from '@whiteboard/editor'
import type { NodeRegistry } from './node'

export type WhiteboardRuntime = Omit<EditorBaseRuntime, 'registry'> & {
  registry: NodeRegistry
}

export type WhiteboardInstance = WhiteboardRuntime
