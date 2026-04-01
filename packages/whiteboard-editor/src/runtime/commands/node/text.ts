import { isTextContentEmpty } from '@whiteboard/core/node'
import type { NodeId, Size } from '@whiteboard/core/types'
import type { EngineInstance } from '@whiteboard/engine'
import type { NodePatch } from '../../overlay'
import type {
  Editor,
  EditorNodeAppearanceCommands,
  EditorNodeDocumentCommands,
  EditorNodeTextCommands
} from '../../../types/editor'
import type { EditorOverlay } from '../../overlay'
import {
  isNodePatchEqual,
  readNodePatchEntry,
  replaceNodePatchEntry
} from '../../overlay'
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

const writeTextPreview = (
  overlay: Pick<EditorOverlay, 'set'>,
  nodeId: NodeId,
  size?: Size
) => {
  overlay.set((current) => {
    const patch = readNodePatchEntry(current.node.text.patches, nodeId)
    const nextPatch = mergeTextPreviewPatch(patch, size)

    if (isNodePatchEqual(patch, nextPatch)) {
      return current
    }

    return {
      ...current,
      node: {
        ...current.node,
        text: {
          patches: replaceNodePatchEntry(current.node.text.patches, nodeId, nextPatch)
        }
      }
    }
  })
}

const clearTextPreview = (
  overlay: Pick<EditorOverlay, 'set'>,
  nodeId: NodeId
) => {
  overlay.set((current) => {
    const patch = readNodePatchEntry(current.node.text.patches, nodeId)
    if (!patch?.size) {
      return current
    }

    const nextPatch = mergeTextPreviewPatch(patch, undefined)

    return {
      ...current,
      node: {
        ...current.node,
        text: {
          patches: replaceNodePatchEntry(
            current.node.text.patches,
            nodeId,
            nextPatch
          )
        }
      }
    }
  })
}

export const createNodeTextCommands = ({
  read,
  committedNode,
  overlay,
  edit,
  selection,
  deleteCascade,
  document,
  appearance
}: {
  read: Editor['read']
  committedNode: EngineInstance['read']['node']['item']
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
    const committed = committedNode.get(nodeId)
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
      const committed = committedNode.get(id)
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
