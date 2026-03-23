import {
  applySelection,
  type SelectionMode
} from '@whiteboard/core/node'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import {
  createPressRuntime,
  GestureTuning
} from '../../runtime/interaction'
import type { InternalInstance } from '../../runtime/instance'
import { filterNodeIds } from '../../runtime/container'
import type { MarqueeMatch, MarqueeSession } from '../../canvas/Marquee'
import type { EditField } from '../../runtime/edit'
import { createNodeDragSession } from './drag/session'

type NodeEntry = NonNullable<ReturnType<InternalInstance['read']['index']['node']['get']>>
type ContainerState = ReturnType<InternalInstance['state']['container']['get']>

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
  container: ContainerState
}

type NodePressController = {
  begin: (input: PressInput, target: PressTarget) => boolean
  cancel: () => void
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

const hasSelectionChanged = (
  currentSelectedNodeIds: readonly NodeId[],
  nextSelectedNodeIds: readonly NodeId[]
) => (
  nextSelectedNodeIds.length !== currentSelectedNodeIds.length
  || nextSelectedNodeIds.some(
    (selectedNodeId, index) => selectedNodeId !== currentSelectedNodeIds[index]
  )
)

const toSelectionKey = (
  nodeIds: readonly NodeId[]
) => [...nodeIds].sort().join('|')

const readSelectedNodeIds = (
  instance: InternalInstance,
  container: ContainerState
) => filterNodeIds(
  container,
  instance.read.selection.get().target.nodeIds
)

const readStartWorld = (
  instance: InternalInstance,
  input: Pick<PressInput, 'clientX' | 'clientY'>
): Point => instance.viewport.pointer({
  clientX: input.clientX,
  clientY: input.clientY
}).world

const readScope = (
  instance: InternalInstance,
  container: ContainerState,
  target: PressTarget
): ReadonlySet<NodeId> | undefined => {
  if (target.kind === 'node' || target.kind === 'container-body') {
    if (instance.read.node.scene(target.nodeRect.node) === 'container') {
      return new Set<NodeId>(instance.read.tree.get(target.nodeRect.node.id))
    }
  }

  return container.id
    ? new Set<NodeId>(container.ids)
    : undefined
}

const buildSelectionWriter = (
  instance: InternalInstance,
  baseSelectedNodeIds: readonly NodeId[],
  selectionMode: SelectionMode
) => {
  let currentKey = toSelectionKey(baseSelectedNodeIds)

  return (matchedNodeIds: readonly NodeId[]) => {
    const nextSelectedNodeIds = [
      ...applySelection(
        new Set(baseSelectedNodeIds),
        [...matchedNodeIds],
        selectionMode
      )
    ]
    const nextKey = toSelectionKey(nextSelectedNodeIds)
    if (nextKey === currentKey) {
      return
    }

    currentKey = nextKey
    instance.commands.selection.replace(nextSelectedNodeIds)
  }
}

export const createNodePressController = (
  instance: InternalInstance,
  marquee: MarqueeSession
): NodePressController => {
  const press = createPressRuntime(instance.interaction)
  const drag = createNodeDragSession(instance)

  const clearChrome = () => {
    instance.internals.node.chromeHidden.set(false)
  }

  const cancel = () => {
    press.cancel()
    drag.cancel()
    marquee.cancel()
    clearChrome()
  }

  const startPress = (
    input: PressInput,
    options: {
      holdDelay?: number
      onHold?: () => void
      onTap?: (event: PointerEvent) => void
      onDragStart?: (
        event: PointerEvent,
        state: {
          held: boolean
        }
      ) => void
    }
  ) => Boolean(press.start({
    pointerId: input.pointerId,
    capture: input.capture,
    start: {
      clientX: input.clientX,
      clientY: input.clientY
    },
    threshold: GestureTuning.dragMinDistance,
    holdDelay: options.holdDelay,
    onHold: options.onHold,
    onTap: options.onTap,
    onDragStart: options.onDragStart,
    onCleanup: clearChrome
  }))

  const startMarquee = (
    input: PressInput,
    config: {
      scope?: ReadonlySet<NodeId>
      match: MarqueeMatch
      baseSelectedNodeIds: readonly NodeId[]
      selectionMode: SelectionMode
      onTap?: () => void
    },
    moveEvent: PointerEvent
  ) => {
    const applyMatched = buildSelectionWriter(
      instance,
      config.baseSelectedNodeIds,
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
      match: config.match,
      onChange: applyMatched,
      onEnd: (result) => {
        if (result.moved) {
          applyMatched(result.nodeIds)
          return
        }

        config.onTap?.()
      }
    })
    if (!started) {
      return
    }

    if (moveEvent.cancelable) {
      moveEvent.preventDefault()
    }
  }

  const startDrag = (
    input: PressInput,
    config: {
      frame: Rect
      anchorId: NodeId
      nodeIds: readonly NodeId[]
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
      event
    })
  }

  const beginNodePress = (
    input: PressInput,
    target: Extract<PressTarget, { kind: 'node' }>
  ) => {
    const currentSelectedNodeIds = readSelectedNodeIds(instance, input.container)
    const tapSelectionIds = [
      ...applySelection(
        new Set(currentSelectedNodeIds),
        [target.nodeRect.node.id],
        input.selectionMode
      )
    ]
    const repeat = input.selectionMode === 'replace'
      && isSingleSelectedNode(target.nodeRect.node.id, currentSelectedNodeIds)
    const dragSelectionIds = currentSelectedNodeIds.includes(target.nodeRect.node.id)
      ? currentSelectedNodeIds
      : tapSelectionIds
    const clearSelectionOnHold = input.selectionMode === 'replace'
    const scope = readScope(instance, input.container, target)
    const tapAction: 'select' | 'edit' | 'noop' = target.nodeRect.node.locked
      ? 'select'
      : repeat
        ? (target.field ? 'edit' : 'noop')
        : 'select'

    instance.internals.node.chromeHidden.set(!repeat)

    return startPress(input, {
      holdDelay: GestureTuning.holdDelay,
      onHold: () => {
        instance.internals.node.chromeHidden.set(true)
        if (clearSelectionOnHold) {
          instance.commands.selection.clear()
        }
      },
      onTap: (event) => {
        const targetPick = instance.internals.pick.element(
          event.target instanceof Element ? event.target : null
        )
        if (targetPick?.kind !== 'node' || targetPick.id !== target.nodeRect.node.id) {
          return
        }

        if (
          tapAction === 'select'
          && hasSelectionChanged(currentSelectedNodeIds, tapSelectionIds)
        ) {
          instance.commands.selection.replace(tapSelectionIds)
          return
        }

        if (tapAction === 'edit' && target.field) {
          instance.commands.edit.start(target.nodeRect.node.id, target.field)
        }
      },
      onDragStart: (event, state) => {
        if (state.held) {
          startMarquee(input, {
            scope,
            match: 'contain',
            baseSelectedNodeIds: clearSelectionOnHold
              ? []
              : currentSelectedNodeIds,
            selectionMode: clearSelectionOnHold
              ? 'replace'
              : input.selectionMode
          }, event)
          return
        }

        if (hasSelectionChanged(currentSelectedNodeIds, dragSelectionIds)) {
          instance.commands.selection.replace(dragSelectionIds)
        }

        startDrag(input, {
          frame: {
            x: target.nodeRect.node.position.x,
            y: target.nodeRect.node.position.y,
            width: target.nodeRect.rect.width,
            height: target.nodeRect.rect.height
          },
          anchorId: target.nodeRect.node.id,
          nodeIds: dragSelectionIds
        }, event)
      }
    })
  }

  const beginContainerBodyPress = (
    input: PressInput,
    target: Extract<PressTarget, { kind: 'container-body' }>
  ) => {
    const currentSelectedNodeIds = readSelectedNodeIds(instance, input.container)
    const tapSelectionIds = [
      ...applySelection(
        new Set(currentSelectedNodeIds),
        [target.nodeRect.node.id],
        input.selectionMode
      )
    ]
    const repeat = input.selectionMode === 'replace'
      && isSelectedNode(target.nodeRect.node.id, currentSelectedNodeIds)
    const dragSelectionIds = repeat
      ? currentSelectedNodeIds
      : tapSelectionIds
    const scope = readScope(instance, input.container, target)

    instance.internals.node.chromeHidden.set(!repeat)

    return startPress(input, {
      holdDelay: repeat
        ? GestureTuning.holdDelay
        : undefined,
      onHold: repeat
        ? () => {
            instance.internals.node.chromeHidden.set(true)
            instance.commands.selection.clear()
          }
        : undefined,
      onTap: () => {
        if (hasSelectionChanged(currentSelectedNodeIds, tapSelectionIds)) {
          instance.commands.selection.replace(tapSelectionIds)
        }
      },
      onDragStart: (event, state) => {
        if (state.held && repeat) {
          startMarquee(input, {
            scope,
            match: 'contain',
            baseSelectedNodeIds: [],
            selectionMode: 'replace'
          }, event)
          return
        }

        if (!repeat) {
          startMarquee(input, {
            scope,
            match: 'touch',
            baseSelectedNodeIds: currentSelectedNodeIds,
            selectionMode: input.selectionMode
          }, event)
          return
        }

        startDrag(input, {
          frame: {
            x: target.nodeRect.node.position.x,
            y: target.nodeRect.node.position.y,
            width: target.nodeRect.rect.width,
            height: target.nodeRect.rect.height
          },
          anchorId: target.nodeRect.node.id,
          nodeIds: dragSelectionIds
        }, event)
      }
    })
  }

  const beginSelectionBoxPress = (
    input: PressInput,
    target: Extract<PressTarget, { kind: 'selection-box' }>
  ) => {
    const currentSelectedNodeIds = readSelectedNodeIds(instance, input.container)
    if (!currentSelectedNodeIds.length) {
      return false
    }

    return startPress(input, {
      holdDelay: GestureTuning.holdDelay,
      onHold: () => {
        instance.internals.node.chromeHidden.set(true)
        instance.commands.selection.clear()
      },
      onTap: () => {},
      onDragStart: (event, state) => {
        if (state.held) {
          startMarquee(input, {
            scope: readScope(instance, input.container, target),
            match: 'contain',
            baseSelectedNodeIds: [],
            selectionMode: 'replace'
          }, event)
          return
        }

        startDrag(input, {
          frame: target.box,
          anchorId: currentSelectedNodeIds[0]!,
          nodeIds: currentSelectedNodeIds
        }, event)
      }
    })
  }

  const beginBackgroundPress = (
    input: PressInput
  ) => {
    const currentSelectedNodeIds = readSelectedNodeIds(instance, input.container)
    const edgeSelected = instance.read.selection.get().target.edgeId !== undefined

    return startPress(input, {
      onTap: () => {
        if (input.selectionMode === 'replace') {
          instance.commands.selection.clear()
        }
      },
      onDragStart: (event) => {
        if (edgeSelected) {
          instance.commands.selection.clear()
        }

        startMarquee(input, {
          scope: readScope(instance, input.container, {
            kind: 'background'
          }),
          match: 'touch',
          baseSelectedNodeIds: edgeSelected
            ? []
            : currentSelectedNodeIds,
          selectionMode: input.selectionMode
        }, event)
      }
    })
  }

  return {
    begin: (input, target) => {
      if (target.kind === 'node') {
        return beginNodePress(input, target)
      }

      if (target.kind === 'container-body') {
        return beginContainerBodyPress(input, target)
      }

      if (target.kind === 'selection-box') {
        return beginSelectionBoxPress(input, target)
      }

      return beginBackgroundPress(input)
    },
    cancel
  }
}
