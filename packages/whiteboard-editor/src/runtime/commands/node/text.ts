import {
  TEXT_DEFAULT_FONT_SIZE,
  TEXT_PLACEHOLDER
} from '@whiteboard/core/node'
import type { NodeId, Size } from '@whiteboard/core/types'
import {
  isTextContentEmpty,
  measureTextNodeSize
} from '../../../features/node/text'
import type {
  NodeProjectionRuntime,
  NodePatch
} from '../../../features/node/projection/store'
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

const resolveTextCommitSize = ({
  read,
  runtime,
  nodeId,
  value,
  source,
  measuredSize
}: {
  read: Editor['read']
  runtime: NodeProjectionRuntime
  nodeId: NodeId
  value: string
  source?: HTMLElement
  measuredSize?: Size
}) => {
  if (measuredSize) {
    return measuredSize
  }

  if (!source) {
    return runtime.get(nodeId).patch?.size
  }

  const item = read.node.item.get(nodeId)
  if (!item) {
    return runtime.get(nodeId).patch?.size
  }

  return measureTextNodeSize({
    node: item.node,
    content: value,
    placeholder: TEXT_PLACEHOLDER,
    source,
    width: item.rect.width
  }) ?? runtime.get(nodeId).patch?.size
}

const resolveFontSizeMeasure = ({
  read,
  nodeId,
  field,
  source,
  value
}: {
  read: Editor['read']
  nodeId: NodeId
  field: 'text' | 'title'
  source?: HTMLElement
  value?: number
}) => {
  if (!source) {
    return undefined
  }

  const item = read.node.item.get(nodeId)
  if (!item) {
    return undefined
  }

  const content = typeof item.node.data?.[field] === 'string'
    ? item.node.data[field] as string
    : ''

  return measureTextNodeSize({
    node: item.node,
    content,
    placeholder: TEXT_PLACEHOLDER,
    source,
    width: item.rect.width,
    fontSize: value ?? TEXT_DEFAULT_FONT_SIZE
  })
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
    value,
    source
  }) => {
    const item = read.node.item.get(nodeId)
    if (!item || item.node.type !== 'text') {
      return
    }

    const nextSize = measureTextNodeSize({
      node: item.node,
      content: value,
      placeholder: TEXT_PLACEHOLDER,
      source,
      width: item.rect.width,
      minWidth: item.rect.width
    })

    if (!nextSize) {
      return
    }

    writeTextPreview(runtime, nodeId, nextSize)
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
    source,
    measuredSize
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
      ? resolveTextCommitSize({
          read,
          runtime,
          nodeId,
          value: nextValue,
          source,
          measuredSize
        })
      : measuredSize
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
    field = 'text',
    value,
    measuredSizeById,
    sourceById
  }) => document.updateMany(
    nodeIds.map((id) => {
      const committed = read.node.committedItem.get(id)
      const nextMeasuredSize = measuredSizeById?.[id] ?? resolveFontSizeMeasure({
        read,
        nodeId: id,
        field,
        source: sourceById?.[id],
        value
      })
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
