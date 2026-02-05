import { useCallback, useMemo, useRef, useState } from 'react'
import type { Core, Node, NodeId, Point, Size } from '@whiteboard/core'

type NodeOverride = {
  position?: Point
  size?: Size
}

export type NodeViewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
}

export type NodeViewState = {
  viewNodes: Node[]
  setOverrides: (updates: NodeViewUpdate[]) => void
  clearOverrides: (ids?: NodeId[]) => void
  commitOverrides: (updates?: NodeViewUpdate[]) => void
  getOverride: (id: NodeId) => NodeOverride | undefined
}

export type NodeTransientApi = Pick<NodeViewState, 'setOverrides' | 'clearOverrides' | 'commitOverrides'>

export const useNodeViewState = (nodes: Node[], core: Core): NodeViewState => {
  const [overrides, setOverridesState] = useState<Map<NodeId, NodeOverride>>(() => new Map())
  const overridesRef = useRef(overrides)

  overridesRef.current = overrides

  const setOverrides = useCallback((updates: NodeViewUpdate[]) => {
    if (!updates.length) return
    setOverridesState((prev) => {
      const next = new Map(prev)
      updates.forEach((update) => {
        if (!update.position && !update.size) return
        const current = next.get(update.id) ?? {}
        next.set(update.id, {
          position: update.position ?? current.position,
          size: update.size ?? current.size
        })
      })
      return next
    })
  }, [])

  const clearOverrides = useCallback((ids?: NodeId[]) => {
    setOverridesState((prev) => {
      if (!ids || ids.length === 0) return new Map()
      const next = new Map(prev)
      ids.forEach((id) => next.delete(id))
      return next
    })
  }, [])

  const commitOverrides = useCallback(
    (updates?: NodeViewUpdate[]) => {
      const list: NodeViewUpdate[] = updates ??
        Array.from(overridesRef.current.entries()).map(([id, override]) => ({ id, ...override }))
      if (!list.length) return
      const ops = list
        .map((item) => {
          const patch: { position?: Point; size?: Size } = {}
          if (item.position) patch.position = item.position
          if (item.size) patch.size = item.size
          if (!patch.position && !patch.size) return null
          return { id: item.id, patch }
        })
        .filter((item): item is { id: NodeId; patch: { position?: Point; size?: Size } } => Boolean(item))
      if (!ops.length) return
      core.model.node.updateMany(ops)
      if (updates) {
        clearOverrides(updates.map((item) => item.id))
      } else {
        clearOverrides()
      }
    },
    [clearOverrides, core.model.node]
  )

  const viewNodes = useMemo(() => {
    if (!overrides.size) return nodes
    return nodes.map((node) => {
      const override = overrides.get(node.id)
      if (!override) return node
      const position = override.position ?? node.position
      const size = override.size ?? node.size
      if (position === node.position && size === node.size) return node
      return {
        ...node,
        position,
        size
      }
    })
  }, [nodes, overrides])

  const getOverride = useCallback((id: NodeId) => overridesRef.current.get(id), [])

  return {
    viewNodes,
    setOverrides,
    clearOverrides,
    commitOverrides,
    getOverride
  }
}
