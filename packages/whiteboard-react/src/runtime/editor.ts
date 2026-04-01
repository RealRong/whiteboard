import {
  createEditor as createEditorBase,
  type Editor as BaseEditorRuntime,
  type NodeRegistry as EditorNodeRegistry
} from '@whiteboard/editor'
import type { NodeRegistry } from '../types/node'

type CreateEditorInput = Omit<Parameters<typeof createEditorBase>[0], 'registry'> & {
  registry: NodeRegistry
}

export const createEditor = (
  input: CreateEditorInput
): BaseEditorRuntime => createEditorBase({
  ...input,
  registry: input.registry as unknown as EditorNodeRegistry
})
