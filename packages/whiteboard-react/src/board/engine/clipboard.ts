import type {
  ClipboardPacket,
  SliceRoots
} from '@whiteboard/core/document'
import { createClipboardPacket } from '@whiteboard/core/document'
import type { Point } from '@whiteboard/core/types'
import type {
  Editor,
  EditorClipboardTarget
} from '../types/editor'

type ClipboardEditor = Pick<Editor, 'read'> & {
  commands: Omit<Editor['commands'], 'clipboard'>
  state: Pick<Editor['state'], 'viewport'>
}

const applyInsertedRoots = (
  editor: ClipboardEditor,
  inserted: {
    roots: SliceRoots
    allNodeIds: readonly string[]
    allEdgeIds: readonly string[]
  }
) => {
  const nodeIds = inserted.roots.nodeIds.length > 0
    ? inserted.roots.nodeIds
    : inserted.allNodeIds
  const edgeIds = inserted.roots.edgeIds.length > 0
    ? inserted.roots.edgeIds
    : inserted.allEdgeIds

  if (nodeIds.length > 0 || edgeIds.length > 0) {
    editor.commands.selection.replace({
      nodeIds,
      edgeIds
    })
    return
  }

  editor.commands.selection.clear()
}

const readSelectionTarget = (
  editor: ClipboardEditor
): Exclude<EditorClipboardTarget, 'selection'> | undefined => {
  const summary = editor.read.selection.summary.get()
  const target = editor.read.selection.target.get()

  if (summary.items.count > 0) {
    return {
      nodeIds: target.nodeIds,
      edgeIds: target.edgeIds
    }
  }

  return undefined
}

const resolveClipboardTarget = (
  editor: ClipboardEditor,
  target: EditorClipboardTarget
): Exclude<EditorClipboardTarget, 'selection'> | undefined => (
  target === 'selection'
    ? readSelectionTarget(editor)
    : target
)

const readClipboardPacket = (
  editor: ClipboardEditor,
  target: EditorClipboardTarget
): ClipboardPacket | undefined => {
  const resolved = resolveClipboardTarget(editor, target)
  if (!resolved) {
    return undefined
  }

  const exported = editor.read.slice.fromSelection(resolved)
  return exported
    ? createClipboardPacket(exported)
    : undefined
}

export const createClipboard = ({
  editor
}: {
  editor: ClipboardEditor
}): Editor['commands']['clipboard'] => ({
  export: (target = 'selection') =>
    readClipboardPacket(editor, target),
  cut: (target = 'selection') => {
    const resolved = resolveClipboardTarget(editor, target)
    if (!resolved) {
      return undefined
    }

    const packet = readClipboardPacket(editor, resolved)
    if (!packet) {
      return undefined
    }

    if (resolved.edgeIds?.length) {
      const result = editor.commands.edge.delete([...resolved.edgeIds])
      if (!result.ok) {
        return undefined
      }
    }

    if (resolved.nodeIds?.length) {
      const result = editor.commands.node.deleteCascade([...resolved.nodeIds])
      if (!result.ok) {
        return undefined
      }
    }

    return packet
  },
  insert: (
    packet,
    options?: {
      origin?: Point
      ownerId?: string
    }
  ) => {
    const origin = options?.origin ?? { ...editor.state.viewport.get().center }
    const inserted = editor.commands.document.insert(packet.slice, {
      origin,
      ownerId: options?.ownerId,
      roots: packet.roots
    })
    if (!inserted.ok) {
      return false
    }

    applyInsertedRoots(editor, inserted.data)
    return true
  }
})
