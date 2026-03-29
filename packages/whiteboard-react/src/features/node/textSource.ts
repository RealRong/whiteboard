import type { WhiteboardRuntime as Editor } from '../../types/runtime'

type TextField = 'text' | 'title'

const registryByEditor = new WeakMap<Editor, Map<string, HTMLElement>>()

const toSourceKey = (
  nodeId: string,
  field: TextField
) => `${nodeId}:${field}`

const readRegistry = (
  editor: Editor
) => {
  let registry = registryByEditor.get(editor)
  if (!registry) {
    registry = new Map<string, HTMLElement>()
    registryByEditor.set(editor, registry)
  }
  return registry
}

export const bindNodeTextSource = ({
  editor,
  nodeId,
  field,
  current,
  next
}: {
  editor: Editor
  nodeId: string
  field: TextField
  current: HTMLElement | null
  next: HTMLElement | null
}) => {
  const registry = readRegistry(editor)
  const key = toSourceKey(nodeId, field)

  if (current && registry.get(key) === current) {
    registry.delete(key)
  }

  if (next) {
    registry.set(key, next)
  }
}

export const resolveNodeTextSource = ({
  editor,
  nodeId,
  field
}: {
  editor: Editor
  nodeId: string
  field: TextField
}) => registryByEditor.get(editor)?.get(toSourceKey(nodeId, field))
