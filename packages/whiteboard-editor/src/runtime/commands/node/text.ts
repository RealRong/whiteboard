import { isTextContentEmpty } from '@whiteboard/core/node'
import type { NodeId, Size } from '@whiteboard/core/types'
import type {
  NodeProjectionRuntime,
  NodePatch
} from '../../projection/node'
import type {
  Editor,
  EditorNodeAppearanceCommands,
  EditorNodeDocumentCommands,
  EditorNodeTextCommands
} from '../../../types/editor'
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
  runtime: NodeProjectionRuntime,
  nodeId: NodeId,
  size?: Size
) => {
  const current = runtime.get(nodeId).patch
  const next = mergeTextPreviewPatch(current, size)

  if (isSameSize(current?.size, next?.size)) {
    return
  }

  if (next) {
    runtime.patch.write(nodeId, next)
  } else {
    runtime.patch.clear(nodeId)
  }
  runtime.flush()
}

const clearTextPreview = (
  runtime: NodeProjectionRuntime,
  nodeId: NodeId
) => {
  const current = runtime.get(nodeId).patch
  if (!current?.size) {
    return
  }

  const next = mergeTextPreviewPatch(current, undefined)
  if (next) {
    runtime.patch.write(nodeId, next)
  } else {
    runtime.patch.clear(nodeId)
  }
  runtime.flush()
}

export const createNodeTextCommands = ({
  read,
  runtime,
  edit,
  selection,
  deleteCascade,
  document,
  appearance
}: {
  read: Editor['read']
  runtime: NodeProjectionRuntime
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

    writeTextPreview(runtime, nodeId, size)
  },
  clearPreview: (nodeId) => {
    clearTextPreview(runtime, nodeId)
  },
  cancel: ({
    nodeId
  }) => {
    clearTextPreview(runtime, nodeId)
    edit.clear()
  },
  commit: ({
    nodeId,
    field,
    value,
    size
  }) => {
    const committed = read.node.committedItem.get(nodeId)
    if (!committed) {
      clearTextPreview(runtime, nodeId)
      edit.clear()
      return undefined
    }

    const nextValue = value
    const currentValue = typeof committed.node.data?.[field] === 'string'
      ? committed.node.data[field] as string
      : ''
    const nextMeasuredSize = committed.node.type === 'text' && field === 'text'
      ? size ?? runtime.get(nodeId).patch?.size
      : undefined
    const sizeUpdate = nextMeasuredSize && !isSameSize(nextMeasuredSize, committed.rect)
      ? nextMeasuredSize
      : undefined

    clearTextPreview(runtime, nodeId)
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
      const committed = read.node.committedItem.get(id)
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
