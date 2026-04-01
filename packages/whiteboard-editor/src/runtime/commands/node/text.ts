import { isTextContentEmpty } from '@whiteboard/core/node'
import type { NodeId, Size } from '@whiteboard/core/types'
import type {
  NodePatch,
  NodePatchEntry
} from '../../overlay'
import type {
  Editor,
  EditorNodeAppearanceCommands,
  EditorNodeDocumentCommands,
  EditorNodeTextCommands
} from '../../../types/editor'
import type { EditorOverlay } from '../../overlay'
import {
  dataUpdate,
  mergeNodeUpdates,
  styleUpdate
} from './document'

const isSameSize = (
  left: Size | null | undefined,
  right: Size | null | undefined
) => (
  left?.width === right?.width
  && left?.height === right?.height
)

const mergeTextPreviewPatch = (
  patch: NodePatch | undefined,
  size?: Size
): NodePatch | undefined => {
  if (!patch && !size) {
    return undefined
  }

  const next: NodePatch = {
    position: patch?.position,
    rotation: patch?.rotation,
    size
  }

  if (!next.position && next.rotation === undefined && !next.size) {
    return undefined
  }

  return next
}

const isSamePoint = (
  left: { x: number, y: number } | undefined,
  right: { x: number, y: number } | undefined
) => (
  left?.x === right?.x
  && left?.y === right?.y
)

const isSameNodePatch = (
  left: NodePatch | undefined,
  right: NodePatch | undefined
) => (
  isSamePoint(left?.position, right?.position)
  && isSameSize(left?.size, right?.size)
  && left?.rotation === right?.rotation
)

const readOverlayPatch = (
  patches: readonly NodePatchEntry[],
  nodeId: NodeId
): NodePatch | undefined => {
  for (let index = 0; index < patches.length; index += 1) {
    const entry = patches[index]!
    if (entry.id === nodeId) {
      return entry.patch
    }
  }

  return undefined
}

const replaceOverlayPatch = (
  patches: readonly NodePatchEntry[],
  nodeId: NodeId,
  patch: NodePatch | undefined
): readonly NodePatchEntry[] => {
  let changed = false
  const next: NodePatchEntry[] = []

  for (let index = 0; index < patches.length; index += 1) {
    const entry = patches[index]!
    if (entry.id !== nodeId) {
      next.push(entry)
      continue
    }

    if (!patch) {
      changed = true
      continue
    }

    if (isSameNodePatch(entry.patch, patch)) {
      next.push(entry)
      continue
    }

    next.push({
      id: nodeId,
      patch
    })
    changed = true
  }

  if (!patch) {
    return changed
      ? next
      : patches
  }

  const hasPatch = patches.some((entry) => entry.id === nodeId)
  if (hasPatch) {
    return changed
      ? next
      : patches
  }

  return [
    ...patches,
    {
      id: nodeId,
      patch
    }
  ]
}

const writeTextPreview = (
  overlay: Pick<EditorOverlay, 'set'>,
  nodeId: NodeId,
  size?: Size
) => {
  overlay.set((current) => {
    const patch = readOverlayPatch(current.node.patches, nodeId)
    const nextPatch = mergeTextPreviewPatch(patch, size)

    if (isSameSize(patch?.size, nextPatch?.size)) {
      return current
    }

    return {
      ...current,
      node: {
        ...current.node,
        patches: replaceOverlayPatch(current.node.patches, nodeId, nextPatch)
      }
    }
  })
}

const clearTextPreview = (
  overlay: Pick<EditorOverlay, 'set'>,
  nodeId: NodeId
) => {
  overlay.set((current) => {
    const patch = readOverlayPatch(current.node.patches, nodeId)
    if (!patch?.size) {
      return current
    }

    return {
      ...current,
      node: {
        ...current.node,
        patches: replaceOverlayPatch(
          current.node.patches,
          nodeId,
          mergeTextPreviewPatch(patch, undefined)
        )
      }
    }
  })
}

export const createNodeTextCommands = ({
  read,
  overlay,
  edit,
  selection,
  deleteCascade,
  document,
  appearance
}: {
  read: Editor['read']
  overlay: Pick<EditorOverlay, 'set'>
  edit: Editor['commands']['edit']
  selection: Editor['commands']['selection']
  deleteCascade: Editor['commands']['node']['deleteCascade']
  document: EditorNodeDocumentCommands
  appearance: EditorNodeAppearanceCommands
}): EditorNodeTextCommands => ({
  preview: ({
    nodeId,
    size
  }) => {
    const item = read.node.item.get(nodeId)
    if (!item || item.node.type !== 'text') {
      return
    }

    writeTextPreview(overlay, nodeId, size)
  },
  clearPreview: (nodeId) => {
    clearTextPreview(overlay, nodeId)
  },
  cancel: ({
    nodeId
  }) => {
    clearTextPreview(overlay, nodeId)
    edit.clear()
  },
  commit: ({
    nodeId,
    field,
    value,
    size
  }) => {
    const committed = read.node.source.get(nodeId)
    if (!committed) {
      clearTextPreview(overlay, nodeId)
      edit.clear()
      return undefined
    }

    const nextValue = value
    const currentValue = typeof committed.node.data?.[field] === 'string'
      ? committed.node.data[field] as string
      : ''
    const previewItem = read.node.item.get(nodeId)
    const nextMeasuredSize = committed.node.type === 'text' && field === 'text'
      ? size ?? (
          previewItem
            ? {
                width: previewItem.rect.width,
                height: previewItem.rect.height
              }
            : undefined
        )
      : undefined
    const sizeUpdate = nextMeasuredSize && !isSameSize(nextMeasuredSize, committed.rect)
      ? nextMeasuredSize
      : undefined

    clearTextPreview(overlay, nodeId)
    edit.clear()

    if (
      committed.node.type === 'text'
      && field === 'text'
      && isTextContentEmpty(nextValue)
    ) {
      selection.clear()
      return deleteCascade([nodeId])
    }

    if (nextValue === currentValue && !sizeUpdate) {
      return undefined
    }

    return document.update(
      nodeId,
      mergeNodeUpdates(
        dataUpdate(field, nextValue),
        sizeUpdate
          ? {
              fields: {
                size: sizeUpdate
              }
            }
          : undefined
      )
    )
  },
  setColor: (nodeIds, color) =>
    appearance.setTextColor(nodeIds, color),
  setFontSize: ({
    nodeIds,
    value,
    sizeById
  }) => document.updateMany(
    nodeIds.map((id) => {
      const committed = read.node.source.get(id)
      const nextMeasuredSize = committed?.node.type === 'text'
        ? sizeById?.[id]
        : undefined
      const sizeUpdate = committed && nextMeasuredSize && !isSameSize(nextMeasuredSize, committed.rect)
        ? nextMeasuredSize
        : undefined

      return {
        id,
        update: mergeNodeUpdates(
          styleUpdate('fontSize', value),
          sizeUpdate
            ? {
                fields: {
                  size: sizeUpdate
                }
              }
            : undefined
        )
      }
    })
  )
})
