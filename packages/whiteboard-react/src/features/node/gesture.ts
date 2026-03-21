import {
  applySelection,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
import type { EdgeId, NodeId, Operation } from '@whiteboard/core/types'
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
  resolveNodeDragPositions,
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

type MovePlan =
  | {
      kind: 'drag'
    }
  | {
      kind: 'marquee'
      policy: MarqueePolicy
    }

type HoldPlan =
  | {
      kind: 'none'
    }
  | {
      kind: 'marquee'
      clearSelection: boolean
      policy: MarqueePolicy
    }

type PressPlan = {
  chromeHidden: boolean
  tapSelectionIds: readonly NodeId[]
  dragSelectionIds: readonly NodeId[]
  tap: 'select' | 'edit' | 'noop'
  move: MovePlan
  hold: HoldPlan
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

const resolveNodePressPlan = ({
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
}): PressPlan => {
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
    move:
      zone === 'body' && !repeat
        ? {
            kind: 'marquee',
            policy: {
              match: 'touch'
            }
          }
        : {
            kind: 'drag'
          },
    hold:
      zone === 'node' || repeat
        ? {
            kind: 'marquee',
            clearSelection: selectionMode === 'replace',
            policy: {
              match: 'contain',
              exclude: [nodeId]
            }
          }
        : {
            kind: 'none'
          }
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
    instance.internals.node.guides.clear()
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
      draft,
      nodes: readCanvasNodes(),
      config: instance.config
    })
    const edgeUpdates = resolveNodeDragFollowEdges({
      active: draft,
      positions: resolveNodeDragPositions(draft, draft.last),
      edgeIds: draft.relatedEdgeIds,
      readEdge: (edgeId) => instance.engine.read.edge.item.get(edgeId)
    })
    const operations: Operation[] = [
      ...nodeUpdates.map(({ id, patch }) => ({
        type: 'node.update' as const,
        id,
        patch
      })),
      ...edgeUpdates.map(({ id, patch }) => ({
        type: 'edge.update' as const,
        id,
        patch
      }))
    ]
    if (!operations.length) {
      return
    }

    instance.commands.document.apply(operations)
  }

  const updatePreview = (input: {
    clientX: number
    clientY: number
  }) => {
    if (!active) {
      return
    }

    const preview = resolveNodeDragPreview({
      active,
      world: instance.viewport.pointer(input).world,
      zoom: instance.viewport.get().zoom,
      snapEnabled: instance.read.tool.is('select'),
      allowCross: active.allowCross,
      nodes: readCanvasNodes(),
      config: instance.config,
      readSnapCandidatesInRect: (rect) => instance.read.index.snap.inRect(rect)
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
    instance.internals.node.guides.write(preview.guides)
    instance.internals.edge.path.write({
      patches: edgeUpdates.map(({ id, patch }) => ({
        id,
        pathPoints: patch.path?.points
      }))
    })
  }

  const runTap = (
    context: PressContext,
    plan: PressPlan,
    event: PointerEvent
  ) => {
    if (
      context.zone !== 'body'
      && readElementNodeId(event.target) !== context.nodeRect.node.id
    ) {
      return
    }

    if (
      plan.tap === 'select'
      && hasSelectionChanged(context.currentSelectedNodeIds, plan.tapSelectionIds)
    ) {
      instance.commands.selection.replace(plan.tapSelectionIds)
      return
    }

    if (plan.tap === 'edit' && context.field) {
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
    plan: PressPlan,
    moveEvent: PointerEvent
  ) => {
    if (context.nodeRect.node.locked) {
      return
    }

    if (hasSelectionChanged(context.currentSelectedNodeIds, plan.dragSelectionIds)) {
      instance.commands.selection.replace(plan.dragSelectionIds)
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
      selectedNodeIds: plan.dragSelectionIds
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
    instance.internals.node.guides.clear()
    nextSession.pan(moveEvent)
    updatePreview(moveEvent)

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startPress = (
    context: PressContext,
    plan: PressPlan
  ) => {
    const hold = plan.hold
    instance.internals.node.chromeHidden.set(plan.chromeHidden)

    const started = press.start({
      pointerId: context.pointerId,
      capture: context.capture,
      start: {
        clientX: context.start.clientX,
        clientY: context.start.clientY
      },
      threshold: GestureTuning.dragMinDistance,
      holdDelay: hold.kind === 'marquee'
        ? GestureTuning.holdDelay
        : undefined,
      onHold: hold.kind === 'marquee'
        ? () => {
            instance.internals.node.chromeHidden.set(true)
            if (hold.clearSelection) {
              instance.commands.selection.clear()
            }
          }
        : undefined,
      onTap: (event) => {
        runTap(context, plan, event)
      },
      onDragStart: (event, state) => {
        if (state.held && hold.kind === 'marquee') {
          startMarquee(context, hold.policy, event)
          return
        }

        if (plan.move.kind === 'drag') {
          startDrag(context, plan, event)
          return
        }

        startMarquee(context, plan.move.policy, event)
      },
      onCleanup: () => {
        clearChrome()
      }
    })

    return Boolean(started)
  }

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

      const currentSelectedNodeIds = filterNodeIds(
        container,
        instance.read.selection.get().target.nodeIds
      )
      const context: PressContext = {
        pointerId: event.pointerId,
        capture: event.currentTarget,
        nodeRect,
        start: {
          clientX: event.clientX,
          clientY: event.clientY,
          world: instance.viewport.pointer(event).world
        },
        currentSelectedNodeIds,
        containerNodeIds: readMarqueeScope(instance, nodeRect.node.id, container),
        selectionMode: resolveSelectionMode(event),
        zone: 'node',
        field: readEditableFieldTarget(event.target)
      }
      const plan = resolveNodePressPlan({
        nodeId,
        zone: context.zone,
        field: context.field,
        locked: Boolean(nodeRect.node.locked),
        selectionMode: context.selectionMode,
        currentSelectedNodeIds
      })
      if (!startPress(context, plan)) {
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
      const currentSelectedNodeIds = filterNodeIds(
        container,
        instance.read.selection.get().target.nodeIds
      )
      const context: PressContext = {
        pointerId: event.pointerId,
        capture,
        nodeRect,
        start: {
          clientX: event.clientX,
          clientY: event.clientY,
          world: instance.viewport.pointer(event).world
        },
        currentSelectedNodeIds,
        containerNodeIds: readMarqueeScope(instance, nodeRect.node.id, container),
        selectionMode: resolveSelectionMode(event),
        zone: 'body'
      }
      const plan = resolveNodePressPlan({
        nodeId,
        zone: context.zone,
        locked: Boolean(nodeRect.node.locked),
        selectionMode: context.selectionMode,
        currentSelectedNodeIds
      })
      if (!startPress(context, plan)) {
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
