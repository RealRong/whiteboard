import {
  createEditor as createEditorBase,
  type Editor as EditorBase,
  type InternalEditor as InternalEditorBase
} from '@whiteboard/editor'
import type { NodeRegistry as EditorNodeRegistry } from '@whiteboard/editor/types'
import type { NodeRegistry } from '../../types/node'

type CreateEditorInput = Omit<Parameters<typeof createEditorBase>[0], 'registry'> & {
  registry: NodeRegistry
}

export const createEditor = (
  input: CreateEditorInput
): InternalEditor => createEditorBase({
  ...input,
  registry: input.registry as unknown as EditorNodeRegistry
}) as InternalEditor

export type Editor = EditorBase
export type InternalEditor = Omit<InternalEditorBase, 'registry'> & {
  registry: NodeRegistry
}

export type { Tool } from '@whiteboard/editor/tool'
