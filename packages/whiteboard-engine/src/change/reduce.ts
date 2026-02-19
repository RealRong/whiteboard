import type { ApplyDispatchResult, Change, ChangeSet, ChangeSource } from '@engine-types/change'
import type { GraphProjector } from '@engine-types/graph'
import type { RefLike } from '@engine-types/ui'
import type { Core, DispatchResult, Document, Operation, Origin } from '@whiteboard/core'

type ReduceContext = {
  core: Core
  graph: GraphProjector
  docRef: RefLike<Document>
  replaceDoc: (doc: Document | null) => void
}

const toCoreOrigin = (source: ChangeSource): Origin => {
  if (source === 'remote') return 'remote'
  if (source === 'system' || source === 'import') return 'system'
  return 'user'
}

const invalid = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

const createUniqueId = (prefix: string, exists: (id: string) => boolean) => {
  const seed = Date.now().toString(36)
  for (let index = 0; index < 1024; index += 1) {
    const id = `${prefix}_${seed}_${index.toString(36)}`
    if (!exists(id)) return id
  }
  return `${prefix}_${seed}_${Math.random().toString(36).slice(2, 8)}`
}

const applyOperations = (
  context: ReduceContext,
  operations: Operation[],
  origin: Origin
) => context.core.apply.operations(operations, { origin })

const applyIntent = (
  context: ReduceContext,
  intent: Parameters<Core['apply']['intent']>[0],
  origin: Origin
) => context.core.apply.intent(intent, { origin })

const reduceChange = async (
  context: ReduceContext,
  change: Change,
  origin: Origin
) => {
  switch (change.type) {
    case 'doc.reset': {
      context.graph.requestFullSync()
      context.docRef.current = change.doc
      context.replaceDoc(change.doc)
      return undefined
    }
    case 'node.create': {
      return applyIntent(context, { type: 'node.create', payload: change.payload }, origin)
    }
    case 'node.update': {
      const node = context.core.query.node.get(change.id)
      if (!node) {
        return invalid(`Node ${change.id} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.update',
            id: change.id,
            patch: change.patch,
            before: node
          }
        ],
        origin
      )
    }
    case 'node.delete': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const node = context.core.query.node.get(id)
        if (!node) {
          return invalid(`Node ${id} not found.`)
        }
        operations.push({
          type: 'node.delete',
          id,
          before: node
        })
      }
      return applyOperations(context, operations, origin)
    }
    case 'node.move': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const node = context.core.query.node.get(id)
        if (!node) {
          return invalid(`Node ${id} not found.`)
        }
        operations.push({
          type: 'node.update',
          id,
          patch: {
            position: {
              x: node.position.x + change.delta.x,
              y: node.position.y + change.delta.y
            }
          },
          before: node
        })
      }
      return applyOperations(context, operations, origin)
    }
    case 'node.resize': {
      const node = context.core.query.node.get(change.id)
      if (!node) {
        return invalid(`Node ${change.id} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.update',
            id: change.id,
            patch: { size: change.size },
            before: node
          }
        ],
        origin
      )
    }
    case 'node.rotate': {
      const node = context.core.query.node.get(change.id)
      if (!node) {
        return invalid(`Node ${change.id} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.update',
            id: change.id,
            patch: { rotation: change.angle },
            before: node
          }
        ],
        origin
      )
    }
    case 'edge.create': {
      return applyIntent(context, { type: 'edge.create', payload: change.payload }, origin)
    }
    case 'edge.update': {
      const edge = context.core.query.edge.get(change.id)
      if (!edge) {
        return invalid(`Edge ${change.id} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.update',
            id: change.id,
            patch: change.patch,
            before: edge
          }
        ],
        origin
      )
    }
    case 'edge.delete': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const operations: Operation[] = []
      for (const id of ids) {
        const edge = context.core.query.edge.get(id)
        if (!edge) {
          return invalid(`Edge ${id} not found.`)
        }
        operations.push({
          type: 'edge.delete',
          id,
          before: edge
        })
      }
      return applyOperations(context, operations, origin)
    }
    case 'edge.connect': {
      return applyIntent(
        context,
        {
          type: 'edge.create',
          payload: {
            source: change.source,
            target: change.target,
            type: 'linear'
          }
        },
        origin
      )
    }
    case 'edge.reconnect': {
      const edge = context.core.query.edge.get(change.id)
      if (!edge) {
        return invalid(`Edge ${change.id} not found.`)
      }
      if (!context.core.query.node.get(change.ref.nodeId)) {
        return invalid(`Node ${change.ref.nodeId} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.update',
            id: change.id,
            patch: change.end === 'source' ? { source: change.ref } : { target: change.ref },
            before: edge
          }
        ],
        origin
      )
    }
    case 'node.order.set': {
      const ids = [...change.ids]
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const allNodeIds = new Set(context.core.query.node.list().map((node) => node.id))
      if (ids.length !== allNodeIds.size) {
        return invalid('Node order length mismatch.')
      }
      const uniqueIds = new Set(ids)
      if (uniqueIds.size !== ids.length) {
        return invalid('Duplicate node ids in order.')
      }
      const missing = ids.find((id) => !allNodeIds.has(id))
      if (missing) {
        return invalid(`Node ${missing} not found.`)
      }
      const missingInOrder = Array.from(allNodeIds).find((id) => !uniqueIds.has(id))
      if (missingInOrder) {
        return invalid(`Node ${missingInOrder} missing from order.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.order.set',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'node.order.bringToFront': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalid(`Node ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.order.bringToFront',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'node.order.sendToBack': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalid(`Node ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.order.sendToBack',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'node.order.bringForward': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalid(`Node ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.order.bringForward',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'node.order.sendBackward': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const currentOrder = context.core.query.document().order.nodes
      const missing = ids.find((id) => !context.core.query.node.get(id))
      if (missing) {
        return invalid(`Node ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'node.order.sendBackward',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'edge.order.set': {
      const ids = [...change.ids]
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const allEdgeIds = new Set(context.core.query.edge.list().map((edge) => edge.id))
      if (ids.length !== allEdgeIds.size) {
        return invalid('Edge order length mismatch.')
      }
      const uniqueIds = new Set(ids)
      if (uniqueIds.size !== ids.length) {
        return invalid('Duplicate edge ids in order.')
      }
      const missing = ids.find((id) => !allEdgeIds.has(id))
      if (missing) {
        return invalid(`Edge ${missing} not found.`)
      }
      const missingInOrder = Array.from(allEdgeIds).find((id) => !uniqueIds.has(id))
      if (missingInOrder) {
        return invalid(`Edge ${missingInOrder} missing from order.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.order.set',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'edge.order.bringToFront': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalid(`Edge ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.order.bringToFront',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'edge.order.sendToBack': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalid(`Edge ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.order.sendToBack',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'edge.order.bringForward': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalid(`Edge ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.order.bringForward',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'edge.order.sendBackward': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No edge ids provided.')
      }
      const currentOrder = context.core.query.document().order.edges
      const missing = ids.find((id) => !context.core.query.edge.get(id))
      if (missing) {
        return invalid(`Edge ${missing} not found.`)
      }
      return applyOperations(
        context,
        [
          {
            type: 'edge.order.sendBackward',
            ids,
            before: currentOrder
          }
        ],
        origin
      )
    }
    case 'group.create': {
      const ids = Array.from(new Set(change.ids))
      if (ids.length === 0) {
        return invalid('No node ids provided.')
      }
      const nodes = ids
        .map((id) => context.core.query.node.get(id))
        .filter((node): node is NonNullable<ReturnType<Core['query']['node']['get']>> => Boolean(node))
      if (nodes.length !== ids.length) {
        const existing = new Set(nodes.map((node) => node.id))
        const missing = ids.find((id) => !existing.has(id))
        return invalid(`Node ${missing} not found.`)
      }
      const minX = Math.min(...nodes.map((node) => node.position.x))
      const minY = Math.min(...nodes.map((node) => node.position.y))
      const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? 0)))
      const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? 0)))
      const groupId = createUniqueId('group', (id) => Boolean(context.core.query.node.get(id)))
      const operations: Operation[] = [
        {
          type: 'node.create',
          node: {
            id: groupId,
            type: 'group',
            layer: 'background',
            position: { x: minX, y: minY },
            size: {
              width: Math.max(0, maxX - minX),
              height: Math.max(0, maxY - minY)
            }
          }
        },
        ...nodes.map(
          (node) =>
            ({
              type: 'node.update',
              id: node.id,
              patch: { parentId: groupId },
              before: node
            }) satisfies Operation
        )
      ]
      return applyOperations(context, operations, origin)
    }
    case 'group.ungroup': {
      const groupNode = context.core.query.node.get(change.id)
      if (!groupNode) {
        return invalid(`Node ${change.id} not found.`)
      }
      const childOperations = context.core.query.node.list()
        .filter((node) => node.parentId === change.id)
        .map(
          (node) =>
            ({
              type: 'node.update',
              id: node.id,
              patch: { parentId: undefined },
              before: node
            }) satisfies Operation
        )
      return applyOperations(
        context,
        [
          ...childOperations,
          {
            type: 'node.delete',
            id: change.id,
            before: groupNode
          }
        ],
        origin
      )
    }
    case 'viewport.set': {
      if (!Number.isFinite(change.viewport.center.x) || !Number.isFinite(change.viewport.center.y)) {
        return invalid('Missing viewport center.')
      }
      if (!Number.isFinite(change.viewport.zoom) || change.viewport.zoom <= 0) {
        return invalid('Invalid viewport zoom.')
      }
      const before = context.core.query.viewport()
      return applyOperations(
        context,
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: { x: change.viewport.center.x, y: change.viewport.center.y },
              zoom: change.viewport.zoom
            }
          }
        ],
        origin
      )
    }
    case 'viewport.panBy': {
      if (!Number.isFinite(change.delta.x) || !Number.isFinite(change.delta.y)) {
        return invalid('Invalid pan delta.')
      }
      const before = context.core.query.viewport()
      return applyOperations(
        context,
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: {
                x: before.center.x + change.delta.x,
                y: before.center.y + change.delta.y
              },
              zoom: before.zoom
            }
          }
        ],
        origin
      )
    }
    case 'viewport.zoomBy': {
      if (!Number.isFinite(change.factor) || change.factor <= 0) {
        return invalid('Invalid zoom factor.')
      }
      if (
        change.anchor &&
        (!Number.isFinite(change.anchor.x) || !Number.isFinite(change.anchor.y))
      ) {
        return invalid('Invalid zoom anchor.')
      }
      const before = context.core.query.viewport()
      const afterCenter = change.anchor
        ? {
            x: change.anchor.x - (change.anchor.x - before.center.x) / change.factor,
            y: change.anchor.y - (change.anchor.y - before.center.y) / change.factor
          }
        : before.center
      return applyOperations(
        context,
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: afterCenter,
              zoom: before.zoom * change.factor
            }
          }
        ],
        origin
      )
    }
    case 'viewport.zoomTo': {
      if (!Number.isFinite(change.zoom) || change.zoom <= 0) {
        return invalid('Invalid viewport zoom.')
      }
      if (
        change.anchor &&
        (!Number.isFinite(change.anchor.x) || !Number.isFinite(change.anchor.y))
      ) {
        return invalid('Invalid zoom anchor.')
      }
      const before = context.core.query.viewport()
      if (before.zoom === 0) {
        return applyOperations(
          context,
          [
            {
              type: 'viewport.update',
              before,
              after: { center: { x: 0, y: 0 }, zoom: change.zoom }
            }
          ],
          origin
        )
      }
      const factor = change.zoom / before.zoom
      const afterCenter = change.anchor
        ? {
            x: change.anchor.x - (change.anchor.x - before.center.x) / factor,
            y: change.anchor.y - (change.anchor.y - before.center.y) / factor
          }
        : before.center
      return applyOperations(
        context,
        [
          {
            type: 'viewport.update',
            before,
            after: {
              center: afterCenter,
              zoom: change.zoom
            }
          }
        ],
        origin
      )
    }
    case 'viewport.reset': {
      const before = context.core.query.viewport()
      return applyOperations(
        context,
        [
          {
            type: 'viewport.update',
            before,
            after: { center: { x: 0, y: 0 }, zoom: 1 }
          }
        ],
        origin
      )
    }
    case 'mindmap.create': {
      return applyIntent(context, { type: 'mindmap.create', payload: change.payload }, origin)
    }
    case 'mindmap.replace': {
      return applyIntent(context, { type: 'mindmap.replace', id: change.id, tree: change.tree }, origin)
    }
    case 'mindmap.delete': {
      return applyIntent(context, { type: 'mindmap.delete', ids: change.ids }, origin)
    }
    case 'mindmap.addChild': {
      return applyIntent(
        context,
        {
          type: 'mindmap.addChild',
          id: change.id,
          parentId: change.parentId,
          payload: change.payload,
          options: change.options
        },
        origin
      )
    }
    case 'mindmap.addSibling': {
      return applyIntent(
        context,
        {
          type: 'mindmap.addSibling',
          id: change.id,
          nodeId: change.nodeId,
          position: change.position,
          payload: change.payload,
          options: change.options
        },
        origin
      )
    }
    case 'mindmap.moveSubtree': {
      return applyIntent(
        context,
        {
          type: 'mindmap.moveSubtree',
          id: change.id,
          nodeId: change.nodeId,
          newParentId: change.newParentId,
          options: change.options
        },
        origin
      )
    }
    case 'mindmap.removeSubtree': {
      return applyIntent(context, { type: 'mindmap.removeSubtree', id: change.id, nodeId: change.nodeId }, origin)
    }
    case 'mindmap.cloneSubtree': {
      return applyIntent(context, { type: 'mindmap.cloneSubtree', id: change.id, nodeId: change.nodeId, options: change.options }, origin)
    }
    case 'mindmap.toggleCollapse': {
      return applyIntent(
        context,
        {
          type: 'mindmap.toggleCollapse',
          id: change.id,
          nodeId: change.nodeId,
          collapsed: change.collapsed
        },
        origin
      )
    }
    case 'mindmap.setNodeData': {
      return applyIntent(context, { type: 'mindmap.setNodeData', id: change.id, nodeId: change.nodeId, patch: change.patch }, origin)
    }
    case 'mindmap.reorderChild': {
      return applyIntent(
        context,
        {
          type: 'mindmap.reorderChild',
          id: change.id,
          parentId: change.parentId,
          fromIndex: change.fromIndex,
          toIndex: change.toIndex
        },
        origin
      )
    }
    case 'mindmap.setSide': {
      return applyIntent(context, { type: 'mindmap.setSide', id: change.id, nodeId: change.nodeId, side: change.side }, origin)
    }
    case 'mindmap.attachExternal': {
      return applyIntent(
        context,
        {
          type: 'mindmap.attachExternal',
          id: change.id,
          targetId: change.targetId,
          payload: change.payload,
          options: change.options
        },
        origin
      )
    }
    default: {
      const exhaustive: never = change
      throw new Error(`Unknown change type: ${(exhaustive as { type?: string }).type ?? 'unknown'}`)
    }
  }
}

export const reduceChangeSet = async (
  context: ReduceContext,
  changeSet: ChangeSet
): Promise<ApplyDispatchResult[]> => {
  const dispatchResults: ApplyDispatchResult[] = []
  const origin = toCoreOrigin(changeSet.source)
  for (let index = 0; index < changeSet.changes.length; index += 1) {
    const change = changeSet.changes[index]
    const result = await reduceChange(context, change, origin)
    if (!result) continue
    dispatchResults.push({
      index,
      type: change.type,
      result
    })
  }
  return dispatchResults
}
