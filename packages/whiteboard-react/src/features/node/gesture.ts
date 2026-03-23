import {
  isPointInRect
} from '@whiteboard/core/geometry'
import { resolveSelectionMode } from '@whiteboard/core/node'
import type { NodeId, Point } from '@whiteboard/core/types'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { MarqueeSession } from '../../canvas/Marquee'
import {
  isBackgroundPointerTarget,
  isCanvasContentIgnoredTarget,
  isEditableTarget,
  isInputIgnoredTarget,
  isSelectionIgnoredTarget,
  readEditableFieldTarget
} from '../../canvas/target'
import type { InternalInstance } from '../../runtime/instance'
import {
  enter,
  hasNode,
  leave
} from '../../runtime/container'
import {
  createNodePressController,
  type PressInput,
  type PressTarget
} from './press'

type ContainerState = ReturnType<InternalInstance['state']['container']['get']>

type PointerGestureEvent = PointerEvent | ReactPointerEvent<Element>

const readNodeTarget = (
  instance: InternalInstance,
  nodeId: NodeId,
  eventTarget: EventTarget | null
): PressTarget | undefined => {
  const nodeRect = instance.read.index.node.get(nodeId)
  if (!nodeRect) {
    return undefined
  }

  return {
    kind: 'node',
    nodeRect,
    field: readEditableFieldTarget(eventTarget)
  }
}

const readSelectionBoxTarget = (
  instance: InternalInstance
): PressTarget | undefined => {
  const selection = instance.read.selection.get()
  if (selection.items.count <= 1 || !selection.box) {
    return undefined
  }

  return {
    kind: 'selection-box',
    box: selection.box
  }
}

const resolveActiveContainer = (
  instance: InternalInstance,
  world: Point
): ContainerState => {
  const container = instance.state.container.get()
  if (!container.id) {
    return container
  }

  const activeRect = instance.read.index.node.get(container.id)?.rect
  if (activeRect && isPointInRect(world, activeRect)) {
    return container
  }

  leave(instance)
  return instance.state.container.get()
}

const resolveBackgroundTarget = ({
  instance,
  container,
  currentTarget,
  target,
  world
}: {
  instance: InternalInstance
  container: ContainerState
  currentTarget: HTMLDivElement
  target: EventTarget | null
  world: Point
}): PressTarget | undefined => {
  if (!isBackgroundPointerTarget({
    target,
    currentTarget,
    activeContainerId: container.id
  })) {
    return undefined
  }

  if (container.id) {
    return {
      kind: 'background'
    }
  }

  const containerNodeId = instance.read.node.containerAt(world)
  if (!containerNodeId) {
    return {
      kind: 'background'
    }
  }

  const nodeRect = instance.read.index.node.get(containerNodeId)
  if (!nodeRect) {
    return undefined
  }

  return {
    kind: 'container-body',
    nodeRect
  }
}

const stopPointerDown = (
  event: PointerGestureEvent
) => {
  if (event.cancelable) {
    event.preventDefault()
  }
  event.stopPropagation()
}

export const createNodeGesture = (
  instance: InternalInstance,
  marquee: MarqueeSession
) => {
  const press = createNodePressController(instance, marquee)

  const canStartPointerGesture = () => (
    instance.interaction.mode.get() === 'idle'
    && instance.read.tool.is('select')
  )

  const beginPointerGesture = (input: {
    event: PointerGestureEvent
    capture: Element
    container: ContainerState
    target: PressTarget
  }) => {
    const started = press.begin({
      pointerId: input.event.pointerId,
      capture: input.capture,
      clientX: input.event.clientX,
      clientY: input.event.clientY,
      selectionMode: resolveSelectionMode(input.event),
      container: input.container
    } satisfies PressInput, input.target)
    if (!started) {
      return false
    }

    stopPointerDown(input.event)
    return true
  }

  return {
    cancel: press.cancel,
    handleNodePointerDown: (
      nodeId: NodeId,
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (!canStartPointerGesture()) return
      if (
        isEditableTarget(event.target)
        || isInputIgnoredTarget(event.target)
        || isSelectionIgnoredTarget(event.target)
      ) {
        return
      }

      const target = readNodeTarget(instance, nodeId, event.target)
      if (!target) {
        return
      }

      let container = instance.state.container.get()
      if (!hasNode(container, nodeId)) {
        leave(instance)
        container = instance.state.container.get()
      }

      beginPointerGesture({
        event,
        capture: event.currentTarget,
        container,
        target
      })
    },
    handleSelectionBoxPointerDown: (
      event: ReactPointerEvent<HTMLDivElement>
    ) => {
      if (event.button !== 0) return
      if (!canStartPointerGesture()) return
      if (isSelectionIgnoredTarget(event.target) || isInputIgnoredTarget(event.target)) {
        return
      }

      const target = readSelectionBoxTarget(instance)
      if (!target) {
        return
      }

      beginPointerGesture({
        event,
        capture: event.currentTarget,
        container: instance.state.container.get(),
        target
      })
    },
    handleBackgroundPointerDown: (
      container: HTMLDivElement,
      event: PointerEvent
    ) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (!canStartPointerGesture()) return

      const startPointer = instance.viewport.pointer(event)
      const activeContainer = resolveActiveContainer(instance, startPointer.world)
      const target = resolveBackgroundTarget({
        instance,
        container: activeContainer,
        currentTarget: container,
        target: event.target,
        world: startPointer.world
      })
      if (!target) {
        return
      }

      beginPointerGesture({
        event,
        capture: container,
        container: activeContainer,
        target
      })
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
