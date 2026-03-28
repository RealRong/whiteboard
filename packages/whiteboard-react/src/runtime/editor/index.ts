import {
  createEditor as createEditorBase,
  type Editor as EditorBase,
  type NodeRegistry as EditorNodeRegistry
} from '@whiteboard/editor'
import type { NodeRegistry } from '../../types/node'

type CreateEditorInput = Omit<Parameters<typeof createEditorBase>[0], 'registry'> & {
  registry: NodeRegistry
}

export const createEditor = (
  input: CreateEditorInput
): WhiteboardInstance => createEditorBase({
  ...input,
  registry: input.registry as unknown as EditorNodeRegistry
}) as WhiteboardInstance

export type WhiteboardInstance = Omit<EditorBase, 'host'> & {
  host: Omit<EditorBase['host'], 'registry'> & {
    registry: NodeRegistry
  }
}

export type Editor = WhiteboardInstance
