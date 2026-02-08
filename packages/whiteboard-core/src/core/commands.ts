import type {
  Core,
  DispatchFailure,
  DispatchResult,
  EdgeAnchor,
  EdgeId,
  Intent,
  MindmapAttachPayload,
  MindmapCreateInput,
  MindmapId,
  MindmapNodeData,
  MindmapNodeId,
  MindmapTree,
  MindmapIntentOptions,
  Node,
  NodeId,
  NodeInput,
  Rect,
  Size,
  Viewport,
  TransactionOptions,
  TransactionResult
} from '../types/core'
import type { CoreState } from './state'
import { mergeChangeSets } from './changes'

type CommandDeps = {
  state: CoreState
  dispatch: (intent: Intent) => Promise<DispatchResult>
  transaction: <T>(fn: () => T | Promise<T>, options?: TransactionOptions) => Promise<TransactionResult<T>>
  createFailure: (reason: DispatchFailure['reason'], message?: string) => DispatchFailure
  createChangeSetId: () => string
  now: () => number
}

export const createCommands = (deps: CommandDeps): Core['commands'] => {
  const { state, dispatch, transaction, createFailure, createChangeSetId, now } = deps

  return {
    node: {
      move: async (ids: NodeId[], delta: { x: number; y: number }) => {
        if (ids.length === 0) return createFailure('invalid', 'No node ids provided.')
        const missing = ids.find((id) => !state.maps.nodes.has(id))
        if (missing) return createFailure('invalid', `Node ${missing} not found.`)
        let failure: DispatchFailure | undefined
        const { changes } = await transaction(async () => {
          for (const id of ids) {
            const node = state.maps.nodes.get(id)
            if (!node) continue
            const nextPosition = { x: node.position.x + delta.x, y: node.position.y + delta.y }
            const result = await dispatch({ type: 'node.update', id, patch: { position: nextPosition } })
            if (!result.ok) {
              failure = result
              break
            }
          }
        })
        if (failure) return failure
        if (changes.length === 0) return createFailure('unknown', 'No changes produced.')
        return {
          ok: true,
          changes: mergeChangeSets(changes, createChangeSetId, now, changes[0]?.origin)
        }
      },
      resize: (id: NodeId, size: { width: number; height: number }) => dispatch({ type: 'node.update', id, patch: { size } }),
      rotate: (id: NodeId, angle: number) => dispatch({ type: 'node.update', id, patch: { rotation: angle } })
    },
    order: {
      node: {
        set: (ids: NodeId[]) => dispatch({ type: 'node.order.set', ids }),
        bringToFront: (ids: NodeId[]) => dispatch({ type: 'node.order.bringToFront', ids }),
        sendToBack: (ids: NodeId[]) => dispatch({ type: 'node.order.sendToBack', ids }),
        bringForward: (ids: NodeId[]) => dispatch({ type: 'node.order.bringForward', ids }),
        sendBackward: (ids: NodeId[]) => dispatch({ type: 'node.order.sendBackward', ids })
      },
      edge: {
        set: (ids: EdgeId[]) => dispatch({ type: 'edge.order.set', ids }),
        bringToFront: (ids: EdgeId[]) => dispatch({ type: 'edge.order.bringToFront', ids }),
        sendToBack: (ids: EdgeId[]) => dispatch({ type: 'edge.order.sendToBack', ids }),
        bringForward: (ids: EdgeId[]) => dispatch({ type: 'edge.order.bringForward', ids }),
        sendBackward: (ids: EdgeId[]) => dispatch({ type: 'edge.order.sendBackward', ids })
      }
    },
    edge: {
      connect: (source: { nodeId: NodeId; anchor?: EdgeAnchor }, target: { nodeId: NodeId; anchor?: EdgeAnchor }) =>
        dispatch({ type: 'edge.create', payload: { source, target, type: 'linear' } }),
      reconnect: (id: EdgeId, end: 'source' | 'target', ref: { nodeId: NodeId; anchor?: EdgeAnchor }) =>
        dispatch({
          type: 'edge.update',
          id,
          patch: end === 'source' ? { source: ref } : { target: ref }
        })
    },
    group: {
      create: async (ids: NodeId[]) => {
        if (ids.length === 0) return createFailure('invalid', 'No node ids provided.')
        const nodes = ids.map((id) => state.maps.nodes.get(id)).filter((node): node is Node => Boolean(node))
        if (nodes.length !== ids.length) {
          const missing = ids.find((id) => !state.maps.nodes.has(id))
          return createFailure('invalid', `Node ${missing} not found.`)
        }
        const minX = Math.min(...nodes.map((node) => node.position.x))
        const minY = Math.min(...nodes.map((node) => node.position.y))
        const maxX = Math.max(...nodes.map((node) => node.position.x + (node.size?.width ?? 0)))
        const maxY = Math.max(...nodes.map((node) => node.position.y + (node.size?.height ?? 0)))
        const groupInput: NodeInput = {
          type: 'group',
          position: { x: minX, y: minY },
          size: { width: Math.max(0, maxX - minX), height: Math.max(0, maxY - minY) }
        }
        let failure: DispatchFailure | undefined
        const { changes } = await transaction(async () => {
          const createResult = await dispatch({ type: 'node.create', payload: groupInput })
          if (!createResult.ok) {
            failure = createResult
            return
          }
          const groupOperation = createResult.changes.operations.find(
            (op) => op.type === 'node.create' && op.node.type === 'group'
          )
          const groupId = groupOperation && 'node' in groupOperation ? groupOperation.node.id : undefined
          if (!groupId) {
            failure = createFailure('unknown', 'Group node not created.')
            return
          }
          for (const node of nodes) {
            const updateResult = await dispatch({ type: 'node.update', id: node.id, patch: { parentId: groupId } })
            if (!updateResult.ok) {
              failure = updateResult
              break
            }
          }
        })
        if (failure) return failure
        if (changes.length === 0) return createFailure('unknown', 'No changes produced.')
        return {
          ok: true,
          changes: mergeChangeSets(changes, createChangeSetId, now, changes[0]?.origin)
        }
      },
      ungroup: async (id: NodeId) => {
        const groupNode = state.maps.nodes.get(id)
        if (!groupNode) return createFailure('invalid', `Node ${id} not found.`)
        const children = state.getDocument().nodes.filter((node) => node.parentId === id)
        let failure: DispatchFailure | undefined
        const { changes } = await transaction(async () => {
          for (const child of children) {
            const result = await dispatch({ type: 'node.update', id: child.id, patch: { parentId: undefined } })
            if (!result.ok) {
              failure = result
              return
            }
          }
          const deleteResult = await dispatch({ type: 'node.delete', ids: [id] })
          if (!deleteResult.ok) {
            failure = deleteResult
          }
        })
        if (failure) return failure
        if (changes.length === 0) return createFailure('unknown', 'No changes produced.')
        return {
          ok: true,
          changes: mergeChangeSets(changes, createChangeSetId, now, changes[0]?.origin)
        }
      }
    },
    mindmap: {
      create: (payload?: MindmapCreateInput) => dispatch({ type: 'mindmap.create', payload }),
      replace: (id: MindmapId, tree: MindmapTree) => dispatch({ type: 'mindmap.replace', id, tree }),
      delete: (ids: MindmapId[]) => dispatch({ type: 'mindmap.delete', ids }),
      addChild: (
        id: MindmapId,
        parentId: MindmapNodeId,
        payload?: MindmapNodeData | MindmapAttachPayload,
        options?: MindmapIntentOptions
      ) => dispatch({ type: 'mindmap.addChild', id, parentId, payload, options }),
      addSibling: (
        id: MindmapId,
        nodeId: MindmapNodeId,
        position: 'before' | 'after',
        payload?: MindmapNodeData | MindmapAttachPayload,
        options?: MindmapIntentOptions
      ) => dispatch({ type: 'mindmap.addSibling', id, nodeId, position, payload, options }),
      moveSubtree: (
        id: MindmapId,
        nodeId: MindmapNodeId,
        newParentId: MindmapNodeId,
        options?: MindmapIntentOptions
      ) => dispatch({ type: 'mindmap.moveSubtree', id, nodeId, newParentId, options }),
      removeSubtree: (id: MindmapId, nodeId: MindmapNodeId) => dispatch({ type: 'mindmap.removeSubtree', id, nodeId }),
      cloneSubtree: (
        id: MindmapId,
        nodeId: MindmapNodeId,
        options?: { parentId?: MindmapNodeId; index?: number; side?: 'left' | 'right' }
      ) => dispatch({ type: 'mindmap.cloneSubtree', id, nodeId, options }),
      toggleCollapse: (id: MindmapId, nodeId: MindmapNodeId, collapsed?: boolean) =>
        dispatch({ type: 'mindmap.toggleCollapse', id, nodeId, collapsed }),
      setNodeData: (id: MindmapId, nodeId: MindmapNodeId, patch: Partial<MindmapNodeData>) =>
        dispatch({ type: 'mindmap.setNodeData', id, nodeId, patch }),
      reorderChild: (id: MindmapId, parentId: MindmapNodeId, fromIndex: number, toIndex: number) =>
        dispatch({ type: 'mindmap.reorderChild', id, parentId, fromIndex, toIndex }),
      setSide: (id: MindmapId, nodeId: MindmapNodeId, side: 'left' | 'right') =>
        dispatch({ type: 'mindmap.setSide', id, nodeId, side }),
      attachExternal: (
        id: MindmapId,
        targetId: MindmapNodeId,
        payload: MindmapAttachPayload,
        options?: MindmapIntentOptions
      ) => dispatch({ type: 'mindmap.attachExternal', id, targetId, payload, options })
    },
    viewport: {
      set: (viewport: Viewport) => dispatch({ type: 'viewport.set', viewport }),
      panBy: (delta) => dispatch({ type: 'viewport.pan', delta }),
      zoomBy: (factor, anchor) => dispatch({ type: 'viewport.zoom', factor, anchor }),
      zoomTo: (zoom, anchor) => {
        const current = state.getDocument().viewport
        const currentZoom = current?.zoom ?? 1
        if (currentZoom === 0) {
          return dispatch({ type: 'viewport.set', viewport: { center: { x: 0, y: 0 }, zoom } })
        }
        return dispatch({ type: 'viewport.zoom', factor: zoom / currentZoom, anchor })
      },
      reset: () => dispatch({ type: 'viewport.set', viewport: { center: { x: 0, y: 0 }, zoom: 1 } }),
      fitToView: (rect: Rect, options: { viewportSize: Size; padding?: number }) => {
        const padding = options.padding ?? 0
        const width = Math.max(1, rect.width + padding * 2)
        const height = Math.max(1, rect.height + padding * 2)
        const zoomX = options.viewportSize.width / width
        const zoomY = options.viewportSize.height / height
        const zoom = Math.min(zoomX, zoomY)
        return dispatch({
          type: 'viewport.set',
          viewport: {
            center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
            zoom: Number.isFinite(zoom) && zoom > 0 ? zoom : 1
          }
        })
      }
    },
    transaction
  }
}
