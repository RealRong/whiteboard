import type {
  Commands,
  WriteCommandMap,
  WriteDomain,
  WriteInput
} from '@engine-types/command/api'
import type { CommandSource } from '@engine-types/command/source'
import type { CommandGateway } from '@engine-types/cqrs/command'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { ShortcutAction } from '@engine-types/shortcuts/types'
import type {
  InteractionState,
  SelectionMode
} from '@engine-types/state/model'
import type {
  EdgeCommandsApi,
  InteractionCommandsApi,
  MindmapCommandsApi,
  NodeCommandsApi,
  SelectionCommandsApi,
  ShortcutActionDispatcher,
  ViewportCommandsApi,
  WriteCommandsApi
} from '@engine-types/write/commands'
import {
  createEdgeDuplicateInput
} from '@whiteboard/core/edge'
import {
  applySelection,
  createNodeDuplicateInput,
  expandNodeSelection
} from '@whiteboard/core/node'
import type {
  DispatchResult,
  Document,
  Edge,
  EdgeId,
  EdgeInput,
  EdgePatch,
  Node,
  NodeId,
  NodeInput,
  NodePatch,
  Point
} from '@whiteboard/core/types'
import {
  bringOrderForward,
  bringOrderToFront,
  sanitizeOrderIds,
  sendOrderBackward,
  sendOrderToBack
} from '@whiteboard/core/utils'
import { DEFAULT_TUNING } from '../../config'
import { createBatchId } from './id'
import type { Apply } from './model'

type NodeCommand = WriteCommandMap['node']
type EdgeCommand = WriteCommandMap['edge']
type ViewportCommand = WriteCommandMap['viewport']

export const write = ({
  apply,
  gateway,
  commandGatewayEnabled
}: {
  apply: Apply
  gateway: CommandGateway
  commandGatewayEnabled: boolean
}): WriteCommandsApi => {
  const now = () => Date.now()

  return {
    apply: async <D extends WriteDomain>(payload: WriteInput<D>) => {
      if (!commandGatewayEnabled) {
        return apply(payload)
      }
      const source = payload.source ?? 'ui'
      const commandId = payload.trace?.commandId ?? createBatchId('command')
      const commandResult = await gateway.dispatch<'write.apply', WriteInput<D>>({
        id: commandId,
        type: 'write.apply',
        payload,
        meta: {
          source,
          actorId: undefined,
          correlationId: payload.trace?.correlationId ?? commandId,
          causationId: payload.trace?.causationId,
          transactionId: payload.trace?.transactionId,
          timestamp: payload.trace?.timestamp ?? now()
        }
      })

      if (!commandResult.ok) {
        return {
          ok: false,
          reason: 'invalid',
          message: `[${commandResult.error.code}] ${commandResult.error.message}`
        }
      }

      const raw = commandResult.value
      if (
        raw &&
        typeof raw === 'object' &&
        'ok' in raw &&
        typeof (raw as DispatchResult).ok === 'boolean'
      ) {
        return raw as DispatchResult
      }

      return {
        ok: false,
        reason: 'invalid',
        message: '[invalid_gateway_result] Gateway returned an invalid dispatch result.'
      }
    }
  }
}

export const node = ({
  instance,
  apply
}: {
  instance: Pick<InternalInstance, 'document'>
  apply: Apply
}): NodeCommandsApi => {
  const readDoc = (): Document => instance.document.get()
  const run = (command: NodeCommand, source: CommandSource = 'ui') =>
    apply({
      domain: 'node',
      command,
      source
    })

  const create = (payload: NodeInput) =>
    run({ type: 'create', payload })

  const update = (id: NodeId, patch: NodePatch) =>
    run({ type: 'update', id, patch })

  const updateData = (id: NodeId, patch: Record<string, unknown>) => {
    const current = readDoc().nodes.find((item) => item.id === id)
    if (!current) return undefined
    return update(id, {
      data: {
        ...(current.data ?? {}),
        ...patch
      }
    })
  }

  const updateManyPosition = (updates: Array<{ id: NodeId; position: Point }>) => {
    if (!updates.length) return
    void run({ type: 'updateManyPosition', updates }, 'interaction')
  }

  const remove = (ids: NodeId[]) =>
    run({ type: 'delete', ids })

  const createGroup = (ids: NodeId[]) =>
    run({ type: 'group', ids })

  const ungroup = (id: NodeId) =>
    run({ type: 'ungroup', id })

  const setOrder = (ids: NodeId[]) =>
    run({ type: 'order.set', ids })

  const bringToFront = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(bringOrderToFront(current, target))
  }

  const sendToBack = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(sendOrderToBack(current, target))
  }

  const bringForward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(bringOrderForward(current, target))
  }

  const sendBackward = (ids: NodeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = readDoc().order.nodes
    return setOrder(sendOrderBackward(current, target))
  }

  return {
    create,
    update,
    updateData,
    updateManyPosition,
    delete: remove,
    createGroup,
    ungroup,
    setOrder,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward
  }
}

export const edge = ({
  instance,
  apply
}: {
  instance: Pick<InternalInstance, 'state' | 'query' | 'read' | 'document'>
  apply: Apply
}): EdgeCommandsApi => {
  const run = (command: EdgeCommand, source: CommandSource = 'ui') =>
    apply({
      domain: 'edge',
      command,
      source
    })

  const create = (payload: EdgeInput) =>
    run({ type: 'create', payload })

  const update = (id: EdgeId, patch: EdgePatch) =>
    run({ type: 'update', id, patch })

  const remove = (ids: EdgeId[]) =>
    run({ type: 'delete', ids })

  const select = (id?: EdgeId) => {
    instance.state.batch(() => {
      instance.state.write('selection', (prev) => {
        if (prev.selectedEdgeId === id) return prev
        return {
          ...prev,
          selectedEdgeId: id
        }
      })
    })
  }

  const insertRoutingPoint = (
    item: Edge,
    pathPoints: Point[],
    segmentIndex: number,
    pointWorld: Point
  ) => {
    void run({
      type: 'routing.insert',
      edge: item,
      pathPoints,
      segmentIndex,
      pointWorld
    })
  }

  const moveRoutingPoint = (item: Edge, index: number, pointWorld: Point) => {
    void run({
      type: 'routing.move',
      edge: item,
      index,
      pointWorld
    })
  }

  const removeRoutingPoint = (item: Edge, index: number) => {
    void run({
      type: 'routing.remove',
      edge: item,
      index
    })
  }

  const resetRouting = (item: Edge) => {
    void run({
      type: 'routing.reset',
      edge: item
    })
  }

  const insertRoutingPointAt = (edgeId: EdgeId, pointWorld: Point) => {
    const entry = instance.read.get.edgeById(edgeId)
    if (!entry) return false
    const segmentIndex = instance.query.geometry.nearestEdgeSegment(
      pointWorld,
      entry.path.points
    )
    insertRoutingPoint(entry.edge, entry.path.points, segmentIndex, pointWorld)
    return true
  }

  const removeRoutingPointAt = (edgeId: EdgeId, index: number) => {
    const entry = instance.read.get.edgeById(edgeId)
    if (!entry) return false
    removeRoutingPoint(entry.edge, index)
    return true
  }

  const setOrder = (ids: EdgeId[]) =>
    run({ type: 'order.set', ids })

  const bringToFront = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(bringOrderToFront(current, target))
  }

  const sendToBack = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(sendOrderToBack(current, target))
  }

  const bringForward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(bringOrderForward(current, target))
  }

  const sendBackward = (ids: EdgeId[]) => {
    const target = sanitizeOrderIds(ids)
    const current = instance.document.get().order.edges
    return setOrder(sendOrderBackward(current, target))
  }

  return {
    create,
    update,
    delete: remove,
    select,
    insertRoutingPoint,
    moveRoutingPoint,
    removeRoutingPoint,
    resetRouting,
    insertRoutingPointAt,
    removeRoutingPointAt,
    setOrder,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward
  }
}

const mergeInteraction = (
  prev: InteractionState,
  patch: Partial<InteractionState>
): InteractionState => ({
  ...prev,
  ...patch,
  focus: patch.focus ? { ...prev.focus, ...patch.focus } : prev.focus,
  pointer: patch.pointer
    ? {
        ...prev.pointer,
        ...patch.pointer,
        modifiers: patch.pointer.modifiers
          ? { ...prev.pointer.modifiers, ...patch.pointer.modifiers }
          : prev.pointer.modifiers
      }
    : prev.pointer,
  hover: patch.hover ? { ...prev.hover, ...patch.hover } : prev.hover
})

export const interaction = ({
  instance
}: {
  instance: Pick<InternalInstance, 'state'>
}): InteractionCommandsApi => {
  const update: Commands['interaction']['update'] = (patch) => {
    instance.state.write('interaction', (prev) => mergeInteraction(prev, patch))
  }

  const clearHover: Commands['interaction']['clearHover'] = () => {
    instance.state.write('interaction', (prev) =>
      mergeInteraction(prev, {
        hover: {
          nodeId: undefined,
          edgeId: undefined
        }
      })
    )
  }

  return {
    update,
    clearHover
  }
}

const getCreatedNodeId = (result: DispatchResult, type?: string) => {
  if (!result.ok) return undefined
  const operation = result.changes.operations.find(
    (item): item is { type: 'node.create'; node: Node } =>
      item.type === 'node.create' && item.node && (!type || item.node.type === type)
  )
  return operation?.node?.id
}

export const selection = ({
  instance,
  commands
}: {
  instance: Pick<InternalInstance, 'state' | 'document' | 'read'>
  commands: Pick<Commands, 'group' | 'edge' | 'node'>
}): SelectionCommandsApi => {
  const state = instance.state
  const writeCommands = commands
  const readDoc = (): Document => instance.document.get()
  const getSelectableNodeIds = (): NodeId[] =>
    [...instance.read.get.nodeIds()]
  const getSelectedNodeIds = (): NodeId[] =>
    Array.from(instance.state.read('selection').selectedNodeIds)
  const getSelectedEdgeId = (): EdgeId | undefined =>
    instance.state.read('selection').selectedEdgeId

  const select = (ids: NodeId[], mode: SelectionMode = 'replace') => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        mode,
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, mode)
      }))
    })
  }

  const toggle = (ids: NodeId[]) => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        mode: 'toggle',
        selectedNodeIds: applySelection(prev.selectedNodeIds, ids, 'toggle')
      }))
    })
  }

  const selectAll = () => {
    const ids = getSelectableNodeIds()
    select(ids, 'replace')
  }

  const clear = () => {
    state.batch(() => {
      state.write('selection', (prev) => ({
        ...prev,
        selectedEdgeId: undefined,
        selectedNodeIds: new Set()
      }))
    })
  }

  const groupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (selectedNodeIds.length < 2) return

    const result = await writeCommands.group.create(selectedNodeIds)
    const groupId = getCreatedNodeId(result, 'group')
    if (!groupId) return
    select([groupId], 'replace')
  }

  const ungroupSelected = async () => {
    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = readDoc()
    const groups = doc.nodes.filter(
      (item) => item.type === 'group' && selectedNodeIds.includes(item.id)
    )
    if (!groups.length) return

    for (const group of groups) {
      await writeCommands.group.ungroup(group.id)
    }
    clear()
  }

  const deleteSelected = async () => {
    const selectedEdgeId = getSelectedEdgeId()
    if (selectedEdgeId) {
      await writeCommands.edge.delete([selectedEdgeId])
      writeCommands.edge.select(undefined)
      return
    }

    const selectedNodeIds = getSelectedNodeIds()
    if (!selectedNodeIds.length) return

    const doc = readDoc()
    const { expandedIds } = expandNodeSelection(doc.nodes, selectedNodeIds)
    const ids = Array.from(expandedIds)
    const edgeIds = doc.edges
      .filter(
        (item) =>
          expandedIds.has(item.source.nodeId)
          || expandedIds.has(item.target.nodeId)
      )
      .map((item) => item.id)

    if (edgeIds.length) {
      await writeCommands.edge.delete(edgeIds)
    }
    await writeCommands.node.delete(ids)
    clear()
  }

  const duplicateSelected = async () => {
    const selectedIds = getSelectedNodeIds()
    if (!selectedIds.length) return

    const doc = readDoc()
    const { expandedIds, nodeById } = expandNodeSelection(doc.nodes, selectedIds)
    const nodes = Array.from(expandedIds)
      .map((id) => nodeById.get(id))
      .filter((item): item is Node => Boolean(item))

    const depthCache = new Map<NodeId, number>()
    const getDepth = (item: Node): number => {
      if (!item.parentId || !expandedIds.has(item.parentId)) return 0
      const cached = depthCache.get(item.id)
      if (cached !== undefined) return cached
      const parent = nodeById.get(item.parentId)
      const depth = parent ? getDepth(parent) + 1 : 0
      depthCache.set(item.id, depth)
      return depth
    }

    nodes.sort((a, b) => getDepth(a) - getDepth(b))

    const idMap = new Map<NodeId, NodeId>()
    const createdIds: NodeId[] = []
    const offset = DEFAULT_TUNING.shortcuts.duplicateOffset

    for (const item of nodes) {
      const parentId =
        item.parentId && idMap.has(item.parentId)
          ? idMap.get(item.parentId)
          : item.parentId
      const payload = createNodeDuplicateInput(item, parentId, offset)
      const result = await writeCommands.node.create(payload)
      const createdId = getCreatedNodeId(result)
      if (createdId) {
        idMap.set(item.id, createdId)
        createdIds.push(createdId)
      }
    }

    const edges = doc.edges.filter(
      (item) =>
        expandedIds.has(item.source.nodeId)
        && expandedIds.has(item.target.nodeId)
    )
    for (const item of edges) {
      const sourceId = idMap.get(item.source.nodeId)
      const targetId = idMap.get(item.target.nodeId)
      if (!sourceId || !targetId) continue
      const payload = createEdgeDuplicateInput(item, sourceId, targetId)
      await writeCommands.edge.create(payload)
    }

    if (createdIds.length) {
      select(createdIds, 'replace')
    }
  }

  return {
    name: 'Selection',
    getSelectedNodeIds,
    select,
    toggle,
    selectAll,
    clear,
    groupSelected,
    ungroupSelected,
    deleteSelected,
    duplicateSelected
  }
}

export const mindmap = ({
  apply
}: {
  apply: Apply
}): MindmapCommandsApi => ({
  apply: (command) =>
    apply({
      domain: 'mindmap',
      command,
      source: 'ui'
    })
})

export const viewport = ({
  apply
}: {
  apply: Apply
}): ViewportCommandsApi => {
  const run = (command: ViewportCommand) =>
    apply({
      domain: 'viewport',
      command,
      source: 'ui'
    })

  const set: Commands['viewport']['set'] = (viewport) =>
    run({ type: 'set', viewport })

  const panBy: Commands['viewport']['panBy'] = (delta) =>
    run({ type: 'panBy', delta })

  const zoomBy: Commands['viewport']['zoomBy'] = (factor, anchor?: Point) =>
    run({ type: 'zoomBy', factor, anchor })

  const zoomTo: Commands['viewport']['zoomTo'] = (zoom, anchor?: Point) =>
    run({ type: 'zoomTo', zoom, anchor })

  const reset: Commands['viewport']['reset'] = () =>
    run({ type: 'reset' })

  return {
    set,
    panBy,
    zoomBy,
    zoomTo,
    reset
  }
}

export const shortcut = ({
  selection,
  history
}: {
  selection: Pick<
    SelectionCommandsApi,
    | 'selectAll'
    | 'clear'
    | 'groupSelected'
    | 'ungroupSelected'
    | 'deleteSelected'
    | 'duplicateSelected'
  >
  history: {
    undo: () => boolean
    redo: () => boolean
  }
}): ShortcutActionDispatcher => {
  const execute = (action: ShortcutAction): boolean => {
    switch (action) {
      case 'selection.selectAll':
        selection.selectAll()
        return true
      case 'selection.clear':
        selection.clear()
        return true
      case 'selection.delete':
        void selection.deleteSelected()
        return true
      case 'selection.duplicate':
        void selection.duplicateSelected()
        return true
      case 'group.create':
        void selection.groupSelected()
        return true
      case 'group.ungroup':
        void selection.ungroupSelected()
        return true
      case 'history.undo':
        history.undo()
        return true
      case 'history.redo':
        history.redo()
        return true
      default:
        return false
    }
  }

  return { execute }
}
