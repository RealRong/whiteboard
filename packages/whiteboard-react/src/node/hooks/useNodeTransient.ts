import { useAtom } from 'jotai'
import { useCallback, useRef } from 'react'
import type { NodeId, Point, Size } from '@whiteboard/core'
import { useInstance } from '../../common/hooks'
import type { NodeViewUpdate } from '../state/nodeViewOverridesAtom'
import { nodeViewOverridesAtom } from '../state/nodeViewOverridesAtom'

const isPointEqual = (left: Point | undefined, right: Point | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.x === right.x && left.y === right.y
}

const isSizeEqual = (left: Size | undefined, right: Size | undefined) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return left.width === right.width && left.height === right.height
}

export type NodeTransientApi = {
  setOverrides: (updates: NodeViewUpdate[]) => void
  clearOverrides: (ids?: NodeId[]) => void
  commitOverrides: (updates?: NodeViewUpdate[]) => void
}

export const useNodeTransient = (): NodeTransientApi => {
  const instance = useInstance()
  const [overrides, setOverridesState] = useAtom(nodeViewOverridesAtom)
  const overridesRef = useRef(overrides)

  overridesRef.current = overrides

  const setOverrides = useCallback(
    (updates: NodeViewUpdate[]) => {
      if (!updates.length) return
      setOverridesState((prev) => {
        const next = new Map(prev)
        let changed = false
        updates.forEach((update) => {
          if (!update.position && !update.size) return
          const current = next.get(update.id) ?? {}
          const merged = {
            position: update.position ?? current.position,
            size: update.size ?? current.size
          }
          if (isPointEqual(merged.position, current.position) && isSizeEqual(merged.size, current.size)) {
            return
          }
          changed = true
          next.set(update.id, merged)
        })
        return changed ? next : prev
      })
    },
    [setOverridesState]
  )

  const clearOverrides = useCallback(
    (ids?: NodeId[]) => {
      setOverridesState((prev) => {
        if (!ids || ids.length === 0) return new Map()
        const next = new Map(prev)
        let changed = false
        ids.forEach((id) => {
          if (!next.has(id)) return
          next.delete(id)
          changed = true
        })
        return changed ? next : prev
      })
    },
    [setOverridesState]
  )

  const commitOverrides = useCallback(
    (updates?: NodeViewUpdate[]) => {
      const list: NodeViewUpdate[] =
        updates ??
        Array.from(overridesRef.current.entries()).map(([id, override]) => ({ id, ...override }))
      if (!list.length) return
      const ops = list
        .map((item) => {
          const patch: { position?: Point; size?: Size } = {}
          if (item.position) patch.position = item.position
          if (item.size) patch.size = item.size
          if (!patch.position && !patch.size) return null
          const currentNode = instance.docRef.current?.nodes.find((node) => node.id === item.id)
          if (currentNode) {
            const samePosition =
              patch.position === undefined || isPointEqual(patch.position, currentNode.position)
            const sameSize = patch.size === undefined || isSizeEqual(patch.size, currentNode.size)
            if (samePosition && sameSize) {
              return null
            }
          }
          return { id: item.id, patch }
        })
        .filter((item): item is { id: NodeId; patch: { position?: Point; size?: Size } } => Boolean(item))
      if (!ops.length) return
      instance.core.model.node.updateMany(ops)
      if (updates) {
        clearOverrides(updates.map((item) => item.id))
      } else {
        clearOverrides()
      }
    },
    [clearOverrides, instance.core.model.node]
  )

  return {
    setOverrides,
    clearOverrides,
    commitOverrides
  }
}
