import {
  createEditor as createEditorBase,
  type Editor as EditorBase
} from '@whiteboard/editor'
import type { NodeRegistry as EditorNodeRegistry } from '@whiteboard/editor/types'
import type { NodeRegistry } from '../../types/node'

type CreateEditorInput = Omit<Parameters<typeof createEditorBase>[0], 'registry'> & {
  registry: NodeRegistry
}

export const createEditor = (
  input: CreateEditorInput
): Editor => createEditorBase({
  ...input,
  registry: input.registry as unknown as EditorNodeRegistry
}) as Editor

export type Editor = Omit<EditorBase, 'host'> & {
  host: Omit<EditorBase['host'], 'registry'> & {
    registry: NodeRegistry
  }
}

export type { Tool } from '@whiteboard/editor/tool'
