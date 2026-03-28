import {
  compileNodeFieldUpdate,
  compileNodeFieldUpdates
} from '@whiteboard/core/schema'
import type { Size } from '@whiteboard/core/types'
import type {
  NodeUpdateInput
} from '@whiteboard/core/types'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from '../instance/types'

const mergeNodeUpdates = (
  ...updates: Array<NodeUpdateInput | undefined>
): NodeUpdateInput => {
  const fields = updates.reduce<NodeUpdateInput['fields']>(
    (current, update) => {
      if (!update?.fields) {
        return current
      }

      return {
        ...(current ?? {}),
        ...update.fields
      }
    },
    undefined
  )
  const records = updates.flatMap((update) => update?.records ?? [])

  return {
    ...(fields ? { fields } : {}),
    ...(records.length ? { records } : {})
  }
}

const styleUpdate = (
  path: string,
  value: string | number | undefined
) => compileNodeFieldUpdate(
  {
    scope: 'style',
    path
  },
  value
)

const dataUpdate = (
  path: string,
  value: unknown
) => compileNodeFieldUpdate(
  {
    scope: 'data',
    path
  },
  value
)

export const createNodeCommands = ({
  engine
}: {
  engine: EngineInstance
}): Editor['commands']['node'] => {
  const document: Editor['commands']['node']['document'] = {
    update: engine.commands.node.update,
    updateMany: engine.commands.node.updateMany
  }

  const appearance: Editor['commands']['node']['appearance'] = {
    setFill: (nodeIds, fill) => document.updateMany(
      nodeIds.map((id) => {
        const node = engine.read.node.item.get(id)?.node
        return {
          id,
          update:
            node?.type === 'sticky'
              ? compileNodeFieldUpdates([
                  {
                    field: {
                      scope: 'style',
                      path: 'fill'
                    },
                    value: fill
                  },
                  {
                    field: {
                      scope: 'data',
                      path: 'background'
                    },
                    value: fill
                  }
                ])
              : styleUpdate('fill', fill)
        }
      })
    ),
    setStroke: (nodeIds, stroke) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: styleUpdate('stroke', stroke)
      }))
    ),
    setStrokeWidth: (nodeIds, width) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: styleUpdate('strokeWidth', width)
      }))
    ),
    setOpacity: (nodeIds, opacity) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: styleUpdate('opacity', opacity)
      }))
    ),
    setTextColor: (nodeIds, color) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: styleUpdate('color', color)
      }))
    )
  }

  const text: Editor['commands']['node']['text'] = {
    commit: ({
      nodeId,
      field,
      value,
      measuredSize
    }) => document.update(
      nodeId,
      mergeNodeUpdates(
        dataUpdate(field, value),
        measuredSize
          ? {
              fields: {
                size: measuredSize
              }
            }
          : undefined
      )
    ),
    setColor: (nodeIds, color) =>
      appearance.setTextColor(nodeIds, color),
    setFontSize: ({
      nodeIds,
      value,
      measuredSizeById
    }) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: mergeNodeUpdates(
          styleUpdate('fontSize', value),
          measuredSizeById?.[id]
            ? {
                fields: {
                  size: measuredSizeById[id] as Size
                }
              }
            : undefined
        )
      }))
    )
  }

  const lock: Editor['commands']['node']['lock'] = {
    set: (nodeIds, locked) => document.updateMany(
      nodeIds.map((id) => ({
        id,
        update: {
          fields: {
            locked
          }
        }
      }))
    ),
    toggle: (nodeIds) => {
      const shouldLock = nodeIds.some((id) => !engine.read.node.item.get(id)?.node.locked)
      return lock.set(nodeIds, shouldLock)
    }
  }

  return {
    create: engine.commands.node.create,
    move: engine.commands.node.move,
    align: engine.commands.node.align,
    distribute: engine.commands.node.distribute,
    delete: engine.commands.node.delete,
    deleteCascade: engine.commands.node.deleteCascade,
    duplicate: engine.commands.node.duplicate,
    group: engine.commands.node.group,
    order: engine.commands.node.order,
    document,
    lock,
    text,
    appearance
  }
}
