import {
  isPointInRect
} from '@whiteboard/core/geometry'
import { resolveSelectionMode } from '@whiteboard/core/node'
import type { NodeId } from '@whiteboard/core/types'
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { CanvasDown } from '../../runtime/input/down'
import {
  isCanvasContentIgnoredTarget,
  readEditableFieldTarget
} from '../../runtime/input/target'
import type { InternalInstance } from '../../runtime/instance'
import {
  hasNode
} from '../../runtime/container'
import type { MarqueeSession } from '../selection/chrome/Marquee'
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
  world: {
    x: number
    y: number
  }
): ContainerState => {
  const container = instance.state.container.get()
  if (!container.id) {
    return container
  }

  const activeRect = instance.read.index.node.get(container.id)?.rect
  if (activeRect && isPointInRect(world, activeRect)) {
    return container
  }

  instance.commands.container.exit()
  return instance.state.container.get()
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
    down: (
      input: CanvasDown
    ) => {
      const { event } = input

      if (event.defaultPrevented) return false
      if (event.button !== 0) return false
      if (input.mode !== 'idle' || input.tool.type !== 'select') return false
      if (input.editable || input.ignoreInput || input.ignoreSelection) {
        return false
      }

      if (
        input.pick.kind === 'node'
        && input.pick.part === 'body'
      ) {
        const target = readNodeTarget(instance, input.pick.id, input.element)
        if (!target) {
          return false
        }

        let currentContainer = instance.state.container.get()
        if (!hasNode(currentContainer, input.pick.id)) {
          instance.commands.container.exit()
          currentContainer = instance.state.container.get()
        }

        return beginPointerGesture({
          event,
          capture: input.capture,
          container: currentContainer,
          target
        })
      }

      if (
        input.pick.kind === 'selection-box'
        && input.pick.part === 'body'
      ) {
        const target = readSelectionBoxTarget(instance)
        if (!target) {
          return false
        }

        return beginPointerGesture({
          event,
          capture: input.capture,
          container: instance.state.container.get(),
          target
        })
      }

      const activeContainer = resolveActiveContainer(instance, input.point.world)
      const target = (() => {
        if (input.pick.kind === 'background') {
          return {
            kind: 'background'
          } satisfies PressTarget
        }

        if (
          input.pick.kind === 'node'
          && input.pick.part === 'container'
        ) {
          if (input.pick.id === activeContainer.id) {
            return {
              kind: 'background'
            } satisfies PressTarget
          }

          const nodeRect = instance.read.index.node.get(input.pick.id)
          if (!nodeRect) {
            return undefined
          }

          return {
            kind: 'container-body',
            nodeRect
          } satisfies PressTarget
        }

        return undefined
      })()
      if (!target) {
        return false
      }

      return beginPointerGesture({
        event,
        capture: input.capture,
        container: activeContainer,
        target
      })
    },
    doubleClick: (
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

      instance.commands.container.enter(nodeId)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

export type NodeGesture = ReturnType<typeof createNodeGesture>
