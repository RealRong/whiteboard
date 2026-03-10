import type { NodeReadProjection, ReadContext } from '@engine-types/read'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { NodeViewItem } from '@engine-types/instance'

const subscribeListener = (
  listeners: Set<() => void>,
  listener: () => void
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const notifyListeners = (listeners: ReadonlySet<() => void>) => {
  listeners.forEach((listener) => {
    listener()
  })
}

const readRect = (
  context: ReadContext,
  node: Node,
  nodeId: NodeId
) => context.indexes.node.byId(nodeId)?.rect ?? {
  x: node.position.x,
  y: node.position.y,
  width: node.size?.width ?? 0,
  height: node.size?.height ?? 0
}

export const projection = (context: ReadContext): NodeReadProjection => {
  const entryById = new Map<NodeId, NodeViewItem>()
  const listenersById = new Map<NodeId, Set<() => void>>()
  const idsListeners = new Set<() => void>()
  let idsRef = context.model().indexes.canvasNodeIds as readonly NodeId[]

  const getNodeMap = () => context.model().indexes.canvasNodeById

  const get = (nodeId: NodeId) => {
    const node = getNodeMap().get(nodeId)
    if (!node) {
      entryById.delete(nodeId)
      return undefined
    }

    const rect = readRect(context, node, nodeId)
    const previous = entryById.get(nodeId)
    if (previous && previous.node === node && previous.rect === rect) {
      return previous
    }

    const next: NodeViewItem = {
      node,
      rect
    }
    entryById.set(nodeId, next)
    return next
  }

  const subscribe = (nodeId: NodeId, listener: () => void) => {
    const nodeListeners = listenersById.get(nodeId) ?? new Set<() => void>()
    if (!listenersById.has(nodeId)) {
      listenersById.set(nodeId, nodeListeners)
    }
    nodeListeners.add(listener)
    return () => {
      nodeListeners.delete(listener)
      if (!nodeListeners.size) {
        listenersById.delete(nodeId)
      }
    }
  }

  const notifyNode = (nodeId: NodeId) => {
    const nodeListeners = listenersById.get(nodeId)
    if (!nodeListeners?.size) return
    notifyListeners(nodeListeners)
  }

  const ids = () => idsRef

  const subscribeIds = (listener: () => void) => subscribeListener(idsListeners, listener)

  const applyChange = (impact: KernelReadImpact) => {
    const prevIds = idsRef
    const nextIds = context.model().indexes.canvasNodeIds as readonly NodeId[]
    const idsChanged = prevIds !== nextIds
    idsRef = nextIds

    if (idsChanged) {
      notifyListeners(idsListeners)
    }

    const changedNodeIds = new Set<NodeId>()

    if (
      impact.reset
      || impact.node.list
      || ((impact.node.geometry || impact.node.value) && impact.node.ids.length === 0)
    ) {
      listenersById.forEach((_, nodeId) => {
        changedNodeIds.add(nodeId)
      })
    } else {
      impact.node.ids.forEach((nodeId) => {
        changedNodeIds.add(nodeId)
      })
    }

    if (idsChanged) {
      prevIds.forEach((nodeId) => {
        if (!context.model().indexes.canvasNodeById.has(nodeId)) {
          changedNodeIds.add(nodeId)
        }
      })
    }

    changedNodeIds.forEach((nodeId) => {
      const prevEntry = entryById.get(nodeId)
      const nextEntry = get(nodeId)
      if (prevEntry === nextEntry) return
      notifyNode(nodeId)
    })
  }

  return {
    ids,
    get,
    subscribe,
    subscribeIds,
    applyChange
  }
}
