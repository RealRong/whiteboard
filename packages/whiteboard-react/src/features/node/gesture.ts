import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type {
  MarqueePolicy,
  MarqueeSession
} from '../../canvas/Marquee'
import {
  isCanvasContentIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget,
  readElementNodeId
} from '../../canvas/target'
import type { EditField } from '../../runtime/edit'
import {
  createPressRuntime,
  GestureTuning
} from '../../runtime/interaction'
import type { InternalInstance } from '../../runtime/instance'
import {
  enter,
  filterNodeIds,
  hasNode,
  leave
} from '../../runtime/container'
import {
  buildNodeDragState,
  resolveNodeDragFollowEdges,
  resolveNodeDragCommit,
  resolveNodeDragPosition,
  resolveNodeDragPreview,
  type NodeDragRuntimeState
} from './hooks/drag/math'

type ActiveDrag = NodeDragRuntimeState & {
  pointerId: number
  allowCross: boolean
  relatedEdgeIds: readonly EdgeId[]
}

type NodeGestureZone = 'node' | 'body'

type PressContext = {
  pointerId: number
  capture: Element
  nodeRect: NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
  start: {
    clientX: number
    clientY: number
    world: {
      x: number
      y: number
    }
  }
  currentSelectedNodeIds: readonly NodeId[]
  containerNodeIds?: ReadonlySet<NodeId>
  selectionMode: SelectionMode
  zone: NodeGestureZone
  field?: EditField
}

type PressIntent = {
  chromeHidden: boolean
  tapSelectionIds: readonly NodeId[]
  dragSelectionIds: readonly NodeId[]
  tap: 'select' | 'edit' | 'noop'
  move: 'drag' | 'marquee'
  moveMarqueePolicy?: MarqueePolicy
  hold: 'none' | 'marquee'
  holdMarqueePolicy?: MarqueePolicy
  clearSelectionOnHold: boolean
}

const isSingleSelectedNode = (
  nodeId: NodeId,
  currentSelectedNodeIds: readonly NodeId[]
) => (
  currentSelectedNodeIds.length === 1
  && currentSelectedNodeIds[0] === nodeId
)

const isSelectedNode = (
  nodeId: NodeId,
  currentSelectedNodeIds: readonly NodeId[]
) => currentSelectedNodeIds.includes(nodeId)

const hasSelectionChanged = (
  currentSelectedNodeIds: readonly NodeId[],
  nextSelectedNodeIds: readonly NodeId[]
) => (
  nextSelectedNodeIds.length !== currentSelectedNodeIds.length
  || nextSelectedNodeIds.some(
    (selectedNodeId, index) => selectedNodeId !== currentSelectedNodeIds[index]
  )
)

const resolveNodePressIntent = ({
  nodeId,
  zone,
  field,
  locked,
  selectionMode,
  currentSelectedNodeIds
}: {
  nodeId: NodeId
  zone: NodeGestureZone
  field?: EditField
  locked: boolean
  selectionMode: SelectionMode
  currentSelectedNodeIds: readonly NodeId[]
}): PressIntent => {
  const repeat = selectionMode === 'replace' && (
    zone === 'node'
      ? isSingleSelectedNode(nodeId, currentSelectedNodeIds)
      : isSelectedNode(nodeId, currentSelectedNodeIds)
  )
  const tapSelectionIds = [
    ...applySelection(
      new Set(currentSelectedNodeIds),
      [nodeId],
      selectionMode
    )
  ]
  const dragSelectionIds = zone === 'body'
    ? (
        repeat
          ? currentSelectedNodeIds
          : tapSelectionIds
      )
    : (
        currentSelectedNodeIds.includes(nodeId)
          ? currentSelectedNodeIds
          : tapSelectionIds
      )

  return {
    chromeHidden: !repeat,
    tapSelectionIds,
    dragSelectionIds,
    tap: locked
      ? 'select'
      : repeat
        ? (field ? 'edit' : 'noop')
        : 'select',
    move: zone === 'body' && !repeat ? 'marquee' : 'drag',
    moveMarqueePolicy:
      zone === 'body' && !repeat
        ? {
            match: 'touch'
          }
        : undefined,
    hold: zone === 'node' || repeat ? 'marquee' : 'none',
    holdMarqueePolicy:
      zone === 'node' || repeat
        ? {
            match: 'contain',
            exclude: [nodeId]
          }
        : undefined,
    clearSelectionOnHold:
      (zone === 'node' || repeat)
      && selectionMode === 'replace'
  }
}

const readPressContext = ({
  instance,
  nodeRect,
  container,
  pointerId,
  capture,
  clientX,
  clientY,
  selectionMode,
  field,
  zone
}: {
  instance: InternalInstance
  nodeRect: NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
  container: ReturnType<InternalInstance['state']['container']['get']>
  pointerId: number
  capture: Element
  clientX: number
  clientY: number
  selectionMode: SelectionMode
  zone: NodeGestureZone
  field?: EditField
}): PressContext => {
  const currentSelectedNodeIds = filterNodeIds(
    container,
    instance.read.selection.get().target.nodeIds
  )

  return {
    pointerId,
    capture,
    nodeRect,
    start: {
      clientX,
      clientY,
      world: instance.viewport.pointer({
        clientX,
        clientY
      }).world
    },
    currentSelectedNodeIds,
    containerNodeIds: readMarqueeScope(instance, nodeRect.node.id, container),
    selectionMode,
    zone,
    field
  }
}

const readMarqueeScope = (
  instance: InternalInstance,
  nodeId: NodeId,
  container: ReturnType<InternalInstance['state']['container']['get']>
): ReadonlySet<NodeId> | undefined => {
  const entry = instance.read.index.node.get(nodeId)
  if (!entry) {
    return container.id
      ? new Set<NodeId>(container.ids)
      : undefined
  }

  if (instance.read.node.scene(entry.node) === 'container') {
    return new Set<NodeId>(instance.read.tree.get(nodeId))
  }

  return container.id
    ? new Set<NodeId>(container.ids)
    : undefined
}

export const createNodeGesture = (
  instance: InternalInstance,
  marquee: MarqueeSession
) => {
  let active: ActiveDrag | null = null
  let dragSession: ReturnType<typeof instance.interaction.start> = null
  const press = createPressRuntime(instance.interaction)

  const readCanvasNodes = () => instance.read.index.node.all().map((entry) => entry.node)

  const clearPreview = () => {
    active = null
    dragSession = null
    instance.internals.node.session.clear()
    instance.internals.snap.clear()
    instance.internals.edge.path.clear()
  }

  const clearChrome = () => {
    instance.internals.node.chromeHidden.set(false)
  }

  const clear = () => {
    press.cancel()
    clearChrome()
    clearPreview()
  }

  const commit = (draft: ActiveDrag) => {
    const nodeUpdates = resolveNodeDragCommit({
      draft
    })
    if (!nodeUpdates.length) {
      return
    }

    instance.commands.node.updateMany(nodeUpdates)
  }

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const world = instance.viewport.pointer(input).world
    const rawPosition = resolveNodeDragPosition({
      active,
      world
    })
    const snapped = instance.internals.snap.move({
      rect: {
        x: rawPosition.x,
        y: rawPosition.y,
        width: active.size.width,
        height: active.size.height
      },
      excludeIds: active.members.map((member) => member.id),
      allowCross: active.allowCross,
      disabled: !instance.read.tool.is('select')
    })
    const preview = resolveNodeDragPreview({
      active,
      position: {
        x: snapped.x,
        y: snapped.y
      },
      nodes: readCanvasNodes(),
      config: instance.config
    })

    active.last = preview.position
    const edgeUpdates = resolveNodeDragFollowEdges({
      active,
      positions: preview.patches,
      edgeIds: active.relatedEdgeIds,
      readEdge: (edgeId) => instance.engine.read.edge.item.get(edgeId)
    })

    instance.internals.node.session.write({
      patches: preview.patches,
      hoveredContainerId: preview.hoveredContainerId
    })
    instance.internals.edge.path.write({
      patches: edgeUpdates.map(({ id, patch }) => ({
        id,
        pathPoints: patch.path?.points
      }))
    })
  }

  const runTap = (
    context: PressContext,
    intent: PressIntent,
    event: PointerEvent
  ) => {
    if (
      context.zone !== 'body'
      && readElementNodeId(event.target) !== context.nodeRect.node.id
    ) {
      return
    }

    if (
      intent.tap === 'select'
      && hasSelectionChanged(context.currentSelectedNodeIds, intent.tapSelectionIds)
    ) {
      instance.commands.selection.replace(intent.tapSelectionIds)
      return
    }

    if (intent.tap === 'edit' && context.field) {
      instance.commands.edit.start(context.nodeRect.node.id, context.field)
    }
  }

  const startMarquee = (
    context: PressContext,
    policy: MarqueePolicy,
    moveEvent: PointerEvent
  ) => {
    const started = marquee.start({
      pointerId: context.pointerId,
      capture: context.capture,
      start: instance.viewport.pointer({
        clientX: context.start.clientX,
        clientY: context.start.clientY
      }),
      mode: context.selectionMode,
      baseSelectedNodeIds: context.currentSelectedNodeIds,
      containerNodeIds: context.containerNodeIds,
      policy
    })
    if (!started) {
      return
    }

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startDrag = (
    context: PressContext,
    intent: PressIntent,
    moveEvent: PointerEvent
  ) => {
    if (context.nodeRect.node.locked) {
      return
    }

    if (hasSelectionChanged(context.currentSelectedNodeIds, intent.dragSelectionIds)) {
      instance.commands.selection.replace(intent.dragSelectionIds)
    }

    const drag = buildNodeDragState({
      nodes: readCanvasNodes(),
      anchorId: context.nodeRect.node.id,
      startWorld: context.start.world,
      origin: {
        x: context.nodeRect.node.position.x,
        y: context.nodeRect.node.position.y
      },
      size: {
        width: context.nodeRect.rect.width,
        height: context.nodeRect.rect.height
      },
      selectedNodeIds: intent.dragSelectionIds
    })
    if (!drag.members.length) {
      return
    }

    const nextSession = instance.interaction.start({
      mode: 'node-drag',
      pointerId: context.pointerId,
      capture: context.capture,
      pan: {
        frame: (pointer) => {
          updatePreview(pointer)
        }
      },
      cleanup: () => {
        clearChrome()
        clearPreview()
      },
      move: (event, currentSession) => {
        if (!active) {
          return
        }

        active.allowCross = event.altKey
        currentSession.pan(event)
        updatePreview(event)
      },
      up: (_event, currentSession) => {
        if (!active) {
          return
        }

        commit(active)
        currentSession.finish()
      }
    })
    if (!nextSession) {
      return
    }

    active = {
      pointerId: context.pointerId,
      allowCross: moveEvent.altKey,
      relatedEdgeIds: instance.read.edge.related(drag.members.map((member) => member.id)),
      ...drag
    }
    dragSession = nextSession
    instance.internals.node.session.clear()
    instance.internals.snap.clear()
    nextSession.pan(moveEvent)
    updatePreview(moveEvent)

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startPress = (
    context: PressContext,
    intent: PressIntent
  ) => {
    instance.internals.node.chromeHidden.set(intent.chromeHidden)

    const started = press.start({
      pointerId: context.pointerId,
      capture: context.capture,
      start: {
        clientX: context.start.clientX,
        clientY: context.start.clientY
      },
      threshold: GestureTuning.dragMinDistance,
      holdDelay: intent.hold === 'marquee'
        ? GestureTuning.holdDelay
        : undefined,
      onHold: intent.hold === 'marquee'
        ? () => {
            instance.internals.node.chromeHidden.set(true)
            if (intent.clearSelectionOnHold) {
              instance.commands.selection.clear()
            }
          }
        : undefined,
      onTap: (event) => {
        runTap(context, intent, event)
      },
      onDragStart: (event, state) => {
        if (state.held && intent.hold === 'marquee' && intent.holdMarqueePolicy) {
          startMarquee(context, intent.holdMarqueePolicy, event)
          return
        }

        if (intent.move === 'drag') {
          startDrag(context, intent, event)
          return
        }

        if (intent.moveMarqueePolicy) {
          startMarquee(context, intent.moveMarqueePolicy, event)
        }
      },
      onCleanup: () => {
        clearChrome()
      }
    })

    return Boolean(started)
  }

  const beginPress = (
    context: PressContext
  ) => startPress(
    context,
    resolveNodePressIntent({
      nodeId: context.nodeRect.node.id,
      zone: context.zone,
      field: context.field,
      locked: Boolean(context.nodeRect.node.locked),
      selectionMode: context.selectionMode,
      currentSelectedNodeIds: context.currentSelectedNodeIds
    })
  )

  return {
    cancel: () => {
      if (dragSession) {
        dragSession.cancel()
        return
      }

      clear()
    },
    handleNodePointerDown: (
      nodeId: NodeId,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (dragSession) return
      if (instance.interaction.mode.get() !== 'idle') return
      if (!instance.read.tool.is('select')) return
      if (
        isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
        || isSelectionIgnoredTarget(event.target)
      ) {
        return
      }

      const nodeRect = instance.read.index.node.get(nodeId)
      if (!nodeRect) return

      let container = instance.state.container.get()
      if (!hasNode(container, nodeId)) {
        leave(instance)
        container = instance.state.container.get()
      }

      const context = readPressContext({
        instance,
        nodeRect,
        container,
        pointerId: event.pointerId,
        capture: event.currentTarget,
        clientX: event.clientX,
        clientY: event.clientY,
        selectionMode: resolveSelectionMode(event),
        zone: 'node',
        field: readEditableFieldTarget(event.target)
      })
      if (!beginPress(context)) {
        return
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
    },
    handleContainerBodyPointerDown: (
      nodeId: NodeId,
      capture: HTMLDivElement,
      event: PointerEvent
    ) => {
      if (event.button !== 0) return false
      if (dragSession) return false
      if (instance.interaction.mode.get() !== 'idle') return false
      if (!instance.read.tool.is('select')) return false

      const nodeRect = instance.read.index.node.get(nodeId)
      if (!nodeRect) return false

      const container = instance.state.container.get()
      const context = readPressContext({
        instance,
        nodeRect,
        container,
        pointerId: event.pointerId,
        capture,
        clientX: event.clientX,
        clientY: event.clientY,
        selectionMode: resolveSelectionMode(event),
        zone: 'body'
      })
      if (!beginPress(context)) {
        return false
      }

      if (event.cancelable) {
        event.preventDefault()
      }
      event.stopPropagation()
      return true
    },
    handleNodeDoubleClick: (
      nodeId: NodeId,
      event: ReactMouseEvent<HTMLDivElement>
    ) => {
      if (!instance.read.tool.is('select')) return

      if (isCanvasContentIgnoredTarget(event.target)) {
        return
      }

      if (readEditableFieldTarget(event.target)) {
        return
      }

      const nodeEntry = instance.read.index.node.get(nodeId)
      if (
        !nodeEntry
        || instance.read.node.scene(nodeEntry.node) !== 'container'
      ) {
        return
      }

      enter(instance, nodeId)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

export type NodeGesture = ReturnType<typeof createNodeGesture>
