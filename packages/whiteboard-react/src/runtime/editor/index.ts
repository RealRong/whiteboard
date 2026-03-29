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
): WhiteboardRuntime => createEditorBase({
  ...input,
  registry: input.registry as unknown as EditorNodeRegistry
}) as WhiteboardRuntime

export type WhiteboardInstance = EditorBase

export type WhiteboardRuntime = WhiteboardInstance & {
  host: {
    registry: NodeRegistry
  } & any
}

export type Editor = WhiteboardRuntime
