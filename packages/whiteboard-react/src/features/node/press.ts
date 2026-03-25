import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import {
  isNodeEdgeEnd,
  type Edge,
  type EdgeId,
  type NodeId,
  type Point,
  type Rect
} from '@whiteboard/core/types'
import {
  createPressRuntime,
  GestureTuning
} from '../../runtime/interaction'
import type { InternalInstance } from '../../runtime/instance'
import type { Input as SelectionInput } from '../../runtime/selection'
import { filterNodeIds } from '../../runtime/frame'
import type { EditField } from '../../runtime/edit'
import type { MarqueeMatch, MarqueeSession } from '../selection/Marquee'
import { createNodeDragSession } from './drag/session'

type NodeEntry = NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
type FrameScope = ReturnType<InternalInstance['state']['frame']['get']>

export type PressTarget =
  | {
      kind: 'background'
    }
  | {
      kind: 'selection-box'
      box: Rect
    }
  | {
      kind: 'node'
      hitNodeId: NodeId
      nodeRect: NodeEntry
      field?: EditField
    }
  | {
      kind: 'container-body'
      nodeRect: NodeEntry
    }

export type PressInput = {
  pointerId: number
  capture: Element
  clientX: number
  clientY: number
  selectionMode: SelectionMode
  frame: FrameScope
}

type NodePressController = {
  begin: (input: PressInput, target: PressTarget) => boolean
  cancel: () => void
}

type PressPlan = {
  holdDelay?: number
  hold?: () => void
  tap?: (event: PointerEvent) => void
  drag?: (event: PointerEvent) => void
}

type NodeLikeTarget = Extract<PressTarget, { kind: 'node' | 'container-body' }>

type NodePressState = {
  nodeId: NodeId
  selectedNodeIds: readonly NodeId[]
  selectedEdgeIds: readonly EdgeId[]
  nextTapSelection: SelectionInput
  scope?: ReadonlySet<NodeId>
  frame: Rect
  selected: boolean
  singleSelected: boolean
}

type SelectionMarqueeConfig = {
  scope?: ReadonlySet<NodeId>
  edgeFilter?: (edgeId: EdgeId) => boolean
  match: MarqueeMatch
  baseNodeIds: readonly NodeId[]
  baseEdgeIds: readonly EdgeId[]
  selectionMode: SelectionMode
  clear?: boolean
  onTap?: () => void
}

const isSingleSelectedNode = (
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => (
  selectedNodeIds.length === 1
  && selectedNodeIds[0] === nodeId
)

const isSelectedNode = (
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => selectedNodeIds.includes(nodeId)

const readNearestSelectedGroupId = (
  instance: InternalInstance,
  nodeId: NodeId,
  selectedNodeIds: readonly NodeId[]
) => {
  if (!selectedNodeIds.length) {
    return undefined
  }

  const selectedIdSet = new Set(selectedNodeIds)
  let current = instance.read.node.item.get(nodeId)?.node

  while (current?.groupId) {
    const group = instance.read.node.item.get(current.groupId)?.node
    if (!group) {
      return undefined
    }

    if (group.type === 'group' && selectedIdSet.has(group.id)) {
      return group.id
    }

    current = group
  }

  return undefined
}

const hasSelectionChanged = (
  currentSelection: SelectionInput,
  nextSelection: SelectionInput
) => (
  (nextSelection.nodeIds?.length ?? 0) !== (currentSelection.nodeIds?.length ?? 0)
  || (nextSelection.edgeIds?.length ?? 0) !== (currentSelection.edgeIds?.length ?? 0)
  || (nextSelection.nodeIds ?? []).some(
    (selectedNodeId, index) => selectedNodeId !== currentSelection.nodeIds?.[index]
  )
  || (nextSelection.edgeIds ?? []).some(
    (selectedEdgeId, index) => selectedEdgeId !== currentSelection.edgeIds?.[index]
  )
)

const toSelectionKey = (
  selection: SelectionInput
) => [
  [...(selection.nodeIds ?? [])].sort().join('|'),
  [...(selection.edgeIds ?? [])].sort().join('|')
].join('::')

const readSelectedNodeIds = (
  instance: InternalInstance,
  frame: FrameScope
) => filterNodeIds(
  frame,
  instance.read.selection.get().target.nodeIds
)

const matchesEdgeScope = (
  scope: ReadonlySet<NodeId> | undefined,
  edge: Pick<Edge, 'source' | 'target'>
) => {
  if (!scope) {
    return true
  }

  const hasNodeEnd =
    isNodeEdgeEnd(edge.source)
    || isNodeEdgeEnd(edge.target)

  if (!hasNodeEnd) {
    return false
  }

  return (
    (!isNodeEdgeEnd(edge.source) || scope.has(edge.source.nodeId))
    && (!isNodeEdgeEnd(edge.target) || scope.has(edge.target.nodeId))
  )
}

const readSelectedEdgeIds = (
  instance: InternalInstance,
  frame: FrameScope
) => {
  const edgeIds = instance.read.selection.get().target.edgeIds
  if (!frame.id) {
    return edgeIds
  }

  const scope = new Set(frame.ids)
  return edgeIds.filter((edgeId) => {
    const edge = instance.read.edge.item.get(edgeId)?.edge
    return edge ? matchesEdgeScope(scope, edge) : false
  })
}

const readStartWorld = (
  instance: InternalInstance,
  input: Pick<PressInput, 'clientX' | 'clientY'>
): Point => instance.viewport.pointer({
  clientX: input.clientX,
  clientY: input.clientY
}).world

const readScope = (
  instance: InternalInstance,
  frame: FrameScope,
  target?: NodeLikeTarget
): ReadonlySet<NodeId> | undefined => {
  if (target) {
    if (instance.read.node.scene(target.nodeRect.node) === 'container') {
      return new Set<NodeId>(instance.read.tree.get(target.nodeRect.node.id))
    }
  }

  return frame.id
    ? new Set<NodeId>(frame.ids)
    : undefined
}

const readEdgeFilter = (
  instance: InternalInstance,
  scope: ReadonlySet<NodeId> | undefined
) => {
  if (!scope) {
    return undefined
  }

  return (edgeId: EdgeId) => {
    const edge = instance.read.edge.item.get(edgeId)?.edge
    return edge ? matchesEdgeScope(scope, edge) : false
  }
}

const buildSelectionWriter = (
  instance: InternalInstance,
  baseSelection: SelectionInput,
  selectionMode: SelectionMode
) => {
  let currentKey = toSelectionKey(baseSelection)

  return (matched: SelectionInput) => {
    const nextSelection: SelectionInput = {
      nodeIds: [
        ...applySelection(
          new Set(baseSelection.nodeIds ?? []),
          [...(matched.nodeIds ?? [])],
          selectionMode
        )
      ],
      edgeIds: [
        ...applySelection(
          new Set(baseSelection.edgeIds ?? []),
          [...(matched.edgeIds ?? [])],
          selectionMode
        )
      ]
    }
    const nextKey = toSelectionKey(nextSelection)
    if (nextKey === currentKey) {
      return
    }

    currentKey = nextKey
    instance.commands.selection.replace(nextSelection)
  }
}

const readSelection = (
  state: Pick<NodePressState, 'selectedNodeIds' | 'selectedEdgeIds'>
): SelectionInput => ({
  nodeIds: state.selectedNodeIds,
  edgeIds: state.selectedEdgeIds
})

const readNodeOnlySelection = (
  nodeIds: readonly NodeId[]
): SelectionInput => ({
  nodeIds,
  edgeIds: []
})

const applyNodeTapSelection = (
  selectedNodeIds: readonly NodeId[],
  selectedEdgeIds: readonly EdgeId[],
  nodeId: NodeId,
  selectionMode: SelectionMode
): SelectionInput => ({
  nodeIds: [
    ...applySelection(
      new Set(selectedNodeIds),
      [nodeId],
      selectionMode
    )
  ],
  edgeIds: [
    ...applySelection(
      new Set(selectedEdgeIds),
      [],
      selectionMode
    )
  ]
})

export const createNodePressController = (
  instance: InternalInstance,
  marquee: MarqueeSession
): NodePressController => {
  const press = createPressRuntime(instance.interaction)
  const drag = createNodeDragSession(instance)

  const cancel = () => {
    press.cancel()
    drag.cancel()
    marquee.cancel()
  }

  const runPressPlan = (
    input: PressInput,
    plan: PressPlan
  ) => Boolean(press.start({
    pointerId: input.pointerId,
    capture: input.capture,
    start: {
      clientX: input.clientX,
      clientY: input.clientY
    },
    threshold: GestureTuning.dragMinDistance,
    holdDelay: plan.holdDelay,
    onHold: plan.hold,
    onTap: plan.tap,
    onDragStart: plan.drag
  }))

  const startSelectionMarquee = (
    input: PressInput,
    config: SelectionMarqueeConfig,
    moveEvent?: PointerEvent
  ) => {
    if (config.clear) {
      instance.commands.selection.clear()
    }

    const applyMatched = buildSelectionWriter(
      instance,
      {
        nodeIds: config.baseNodeIds,
        edgeIds: config.baseEdgeIds
      },
      config.selectionMode
    )
    const started = marquee.start({
      pointerId: input.pointerId,
      capture: input.capture,
      start: instance.viewport.pointer({
        clientX: input.clientX,
        clientY: input.clientY
      }),
      scope: config.scope,
      edgeFilter: config.edgeFilter,
      match: config.match,
      onChange: applyMatched,
      onEnd: (result) => {
        if (result.moved) {
          applyMatched({
            nodeIds: result.nodeIds,
            edgeIds: result.edgeIds
          })
          return
        }

        config.onTap?.()
      }
    })
    if (!started) {
      return
    }

    if (moveEvent?.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startDrag = (
    input: PressInput,
    config: {
      frame: Rect
      anchorId: NodeId
      nodeIds: readonly NodeId[]
      edgeIds?: readonly EdgeId[]
    },
    event: PointerEvent
  ) => {
    drag.start({
      pointerId: input.pointerId,
      capture: input.capture,
      start: readStartWorld(instance, input),
      frame: config.frame,
      anchorId: config.anchorId,
      nodeIds: config.nodeIds,
      edgeIds: config.edgeIds,
      event
    })
  }

  const startNodeFrameDrag = (
    input: PressInput,
    state: NodePressState,
    nodeIds: readonly NodeId[],
    edgeIds: readonly EdgeId[],
    event: PointerEvent
  ) => {
    startDrag(input, {
      frame: state.frame,
      anchorId: state.nodeId,
      nodeIds,
      edgeIds
    }, event)
  }

  const readNodeFrame = (
    target: Pick<NodeLikeTarget, 'nodeRect'>
  ): Rect => ({
    x: target.nodeRect.node.position.x,
    y: target.nodeRect.node.position.y,
    width: target.nodeRect.rect.width,
    height: target.nodeRect.rect.height
  })

  const readNodePressState = (
    input: PressInput,
    target: NodeLikeTarget
  ): NodePressState => {
    const nodeId = target.nodeRect.node.id
    const selectedNodeIds = readSelectedNodeIds(instance, input.frame)
    const selectedEdgeIds = readSelectedEdgeIds(instance, input.frame)

    return {
      nodeId,
      selectedNodeIds,
      selectedEdgeIds,
      nextTapSelection: applyNodeTapSelection(
        selectedNodeIds,
        selectedEdgeIds,
        nodeId,
        input.selectionMode
      ),
      scope: readScope(instance, input.frame, target),
      frame: readNodeFrame(target),
      selected: isSelectedNode(nodeId, selectedNodeIds),
      singleSelected: isSingleSelectedNode(nodeId, selectedNodeIds)
    }
  }

  const replaceSelection = (
    currentSelection: SelectionInput,
    nextSelection: SelectionInput
  ) => {
    if (!hasSelectionChanged(currentSelection, nextSelection)) {
      return
    }

    instance.commands.selection.replace(nextSelection)
  }

  const resolveNodeLikePressPlan = (
    input: PressInput,
    target: NodeLikeTarget
  ): PressPlan => {
    const state = readNodePressState(input, target)
    const selection = instance.read.selection.get()
    const currentSelection = readSelection(state)
    const selectedAncestorGroupId = target.kind === 'node'
      ? readNearestSelectedGroupId(instance, target.hitNodeId, state.selectedNodeIds)
      : undefined
    const dragCurrentSelection = Boolean(
      selectedAncestorGroupId
      && input.selectionMode === 'replace'
    )
    const repeat = input.selectionMode === 'replace'
      && (
        target.kind === 'node'
          ? state.singleSelected
          : state.selected
      )
    const dragSelectionIds = repeat
      ? state.selectedNodeIds
      : dragCurrentSelection
        ? state.selectedNodeIds
      : target.kind === 'container-body'
        ? (state.nextTapSelection.nodeIds ?? [])
        : state.selected
          ? state.selectedNodeIds
          : (state.nextTapSelection.nodeIds ?? [])
    const dragSelection = readNodeOnlySelection(dragSelectionIds)
    const dragSelectionEdgeIds =
      repeat || dragCurrentSelection || state.selected
        ? state.selectedEdgeIds
        : []
    const dragFrame = dragCurrentSelection && selection.box
      ? selection.box
      : state.frame
    const edgeFilter = readEdgeFilter(instance, state.scope)
    const hold = () => {
      startSelectionMarquee(input, {
        scope: state.scope,
        edgeFilter,
        match: 'contain',
        baseNodeIds: [],
        baseEdgeIds: [],
        selectionMode: 'replace',
        clear: true
      })
    }

    if (target.kind === 'container-body') {
      return {
        holdDelay: GestureTuning.holdDelay,
        hold,
        tap: () => {
          replaceSelection(currentSelection, state.nextTapSelection)
        },
        drag: (event) => {
          if (!repeat) {
            startSelectionMarquee(input, {
              scope: state.scope,
              edgeFilter,
              match: 'touch',
              baseNodeIds: state.selectedNodeIds,
              baseEdgeIds: state.selectedEdgeIds,
              selectionMode: input.selectionMode
            }, event)
            return
          }

          replaceSelection(currentSelection, dragSelection)
          startNodeFrameDrag(input, state, dragSelectionIds, dragSelectionEdgeIds, event)
        }
      }
    }

    const tapAction: 'select' | 'edit' | 'noop' = target.nodeRect.node.locked
      ? 'select'
      : repeat
        ? (target.field ? 'edit' : 'noop')
        : 'select'

    return {
      holdDelay: GestureTuning.holdDelay,
      hold,
      tap: (event) => {
        const targetPick = instance.internals.pick.element(
          event.target instanceof Element ? event.target : null
        )
        if (
          targetPick?.kind !== 'node'
          || (
            targetPick.id !== target.hitNodeId
            && targetPick.id !== target.nodeRect.node.id
          )
        ) {
          return
        }

        if (tapAction === 'select') {
          replaceSelection(currentSelection, state.nextTapSelection)
          return
        }

        if (tapAction === 'edit' && target.field) {
          instance.commands.edit.start(state.nodeId, target.field)
        }
      },
      drag: (event) => {
        if (dragCurrentSelection) {
          startDrag(input, {
            frame: dragFrame,
            anchorId: dragSelectionIds[0]!,
            nodeIds: dragSelectionIds,
            edgeIds: dragSelectionEdgeIds
          }, event)
          return
        }

        replaceSelection(currentSelection, dragSelection)
        startNodeFrameDrag(input, state, dragSelectionIds, dragSelectionEdgeIds, event)
      }
    }
  }

  const resolveSelectionBoxPressPlan = (
    input: PressInput,
    target: Extract<PressTarget, { kind: 'selection-box' }>
  ): PressPlan | undefined => {
    const selectedNodeIds = readSelectedNodeIds(instance, input.frame)
    const selectedEdgeIds = readSelectedEdgeIds(instance, input.frame)
    const scope = readScope(instance, input.frame)
    const edgeFilter = readEdgeFilter(instance, scope)

    if (!selectedNodeIds.length && !selectedEdgeIds.length) {
      return undefined
    }

    return {
      holdDelay: GestureTuning.holdDelay,
      hold: () => {
        startSelectionMarquee(input, {
          scope,
          edgeFilter,
          match: 'contain',
          baseNodeIds: [],
          baseEdgeIds: [],
          selectionMode: 'replace',
          clear: true
        })
      },
      tap: () => {},
      drag: (event) => {
        if (!selectedNodeIds.length) {
          return
        }

        startDrag(input, {
          frame: target.box,
          anchorId: selectedNodeIds[0]!,
          nodeIds: selectedNodeIds,
          edgeIds: selectedEdgeIds
        }, event)
      }
    }
  }

  const resolveBackgroundPressPlan = (
    input: PressInput
  ): PressPlan => {
    const selectedNodeIds = readSelectedNodeIds(instance, input.frame)
    const scope = readScope(instance, input.frame)
    const selectedEdgeIds = readSelectedEdgeIds(instance, input.frame)
    const edgeFilter = readEdgeFilter(instance, scope)

    return {
      tap: () => {
        if (input.selectionMode === 'replace') {
          instance.commands.selection.clear()
        }
      },
      drag: (event) => {
        startSelectionMarquee(input, {
          scope,
          edgeFilter,
          match: 'touch',
          baseNodeIds: selectedNodeIds,
          baseEdgeIds: selectedEdgeIds,
          selectionMode: input.selectionMode
        }, event)
      }
    }
  }

  const resolvePressPlan = (
    input: PressInput,
    target: PressTarget
  ): PressPlan | undefined => {
    if (target.kind === 'node') {
      return resolveNodeLikePressPlan(input, target)
    }

    if (target.kind === 'container-body') {
      return resolveNodeLikePressPlan(input, target)
    }

    if (target.kind === 'selection-box') {
      return resolveSelectionBoxPressPlan(input, target)
    }

    return resolveBackgroundPressPlan(input)
  }

  return {
    begin: (input, target) => {
      const plan = resolvePressPlan(input, target)
      if (!plan) {
        return false
      }

      return runPressPlan(input, plan)
    },
    cancel
  }
}
