import {
  isPointInRect
} from '@whiteboard/core/geometry'
import {
  isContainerNode,
  resolveSelectionMode,
  type SelectionMode
} from '@whiteboard/core/node'
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
} from '../../runtime/frame'
import type { MarqueeSession } from '../selection/Marquee'
import {
  createNodePressController,
  type PressInput,
  type PressTarget
} from './press'

type FrameScope = ReturnType<InternalInstance['state']['frame']['get']>

type PointerGestureEvent = PointerEvent | ReactPointerEvent<Element>
type PressGesture = {
  frame: FrameScope
  target: PressTarget
}

const readNode = (
  instance: InternalInstance,
  nodeId: NodeId
) => instance.read.node.item.get(nodeId)?.node

const isNodeInGroup = (
  instance: InternalInstance,
  nodeId: NodeId,
  groupId: NodeId
) => {
  let current = readNode(instance, nodeId)

  while (current?.groupId) {
    if (current.groupId === groupId) {
      return true
    }

    current = readNode(instance, current.groupId)
  }

  return false
}

const readNearestGroupId = (
  instance: InternalInstance,
  nodeId: NodeId
) => {
  let current = readNode(instance, nodeId)

  while (current?.groupId) {
    const group = readNode(instance, current.groupId)
    if (!group) {
      return undefined
    }

    if (group.type === 'group') {
      return group.id
    }

    current = group
  }

  return undefined
}

const resolvePressNodeId = (
  instance: InternalInstance,
  nodeId: NodeId,
  selectionMode: SelectionMode
) => {
  if (selectionMode !== 'replace') {
    return nodeId
  }

  const node = readNode(instance, nodeId)
  if (!node || node.type === 'group') {
    return nodeId
  }

  const groupId = readNearestGroupId(instance, nodeId)
  if (!groupId) {
    return nodeId
  }

  const selection = instance.read.selection.get().target.nodeIds
  if (selection.includes(nodeId) || selection.includes(groupId)) {
    return nodeId
  }

  const hasSelectedNodeInGroup = selection.some((selectedNodeId) =>
    isNodeInGroup(instance, selectedNodeId, groupId)
  )

  return hasSelectedNodeInGroup
    ? nodeId
    : groupId
}

const readNodeTarget = (
  instance: InternalInstance,
  nodeId: NodeId,
  selectionMode: SelectionMode,
  field?: ReturnType<typeof readEditableFieldTarget>
): PressTarget | undefined => {
  const resolvedNodeId = resolvePressNodeId(instance, nodeId, selectionMode)
  const nodeRect = instance.read.index.node.get(resolvedNodeId)
  if (!nodeRect) {
    return undefined
  }

  return {
    kind: 'node',
    hitNodeId: nodeId,
    nodeRect,
    field: resolvedNodeId === nodeId
      ? field
      : undefined
  }
}

const readSelectionBoxTarget = (
  instance: InternalInstance
): PressTarget | undefined => {
  const selection = instance.read.selection.get()
  if (
    !selection.box
    || (
      selection.items.count <= 1
      && selection.transform.resize !== 'scale'
    )
  ) {
    return undefined
  }

  return {
    kind: 'selection-box',
    box: selection.box
  }
}

const resolveActiveFrame = (
  instance: InternalInstance,
  world: {
    x: number
    y: number
  }
): FrameScope => {
  const frame = instance.state.frame.get()
  if (!frame.id) {
    return frame
  }

  const activeNode = instance.read.node.item.get(frame.id)?.node
  if (!activeNode || !isContainerNode(activeNode)) {
    instance.commands.frame.exit()
    return instance.state.frame.get()
  }

  const activeRect = instance.read.index.node.get(frame.id)?.rect
  if (activeRect && isPointInRect(world, activeRect)) {
    return frame
  }

  instance.commands.frame.exit()
  return instance.state.frame.get()
}

const stopPointerDown = (
  event: PointerGestureEvent
) => {
  if (event.cancelable) {
    event.preventDefault()
  }
  event.stopPropagation()
}

const canHandleDown = (
  input: CanvasDown
) => (
  !input.event.defaultPrevented
  && input.event.button === 0
  && input.mode === 'idle'
  && input.tool.type === 'select'
  && !input.editable
  && !input.ignoreInput
  && !input.ignoreSelection
)

const resolveNodeBodyGesture = (
  instance: InternalInstance,
  input: CanvasDown
): PressGesture | undefined => {
  if (input.pick.kind !== 'node' || input.pick.part !== 'body') {
    return undefined
  }

  const target = readNodeTarget(
    instance,
    input.pick.id,
    resolveSelectionMode(input.event),
    input.field
  )
  if (!target) {
    return undefined
  }

  let frame = instance.state.frame.get()
  if (!hasNode(frame, input.pick.id)) {
    instance.commands.frame.exit()
    frame = instance.state.frame.get()
  }

  return {
    frame,
    target
  }
}

const resolveSelectionBoxGesture = (
  instance: InternalInstance,
  input: CanvasDown
): PressGesture | undefined => {
  if (input.pick.kind !== 'selection-box' || input.pick.part !== 'body') {
    return undefined
  }

  const target = readSelectionBoxTarget(instance)
  if (!target) {
    return undefined
  }

  return {
    frame: instance.state.frame.get(),
    target
  }
}

const resolveCanvasGesture = (
  instance: InternalInstance,
  input: CanvasDown
): PressGesture | undefined => {
  const frame = resolveActiveFrame(instance, input.point.world)

  if (input.pick.kind === 'background') {
    return {
      frame,
      target: {
        kind: 'background'
      }
    }
  }

  if (input.pick.kind !== 'node' || input.pick.part !== 'container') {
    return undefined
  }

  if (input.pick.id === frame.id) {
    return {
      frame,
      target: {
        kind: 'background'
      }
    }
  }

  const node = readNode(instance, input.pick.id)
  if (node?.type === 'frame') {
    const target = readNodeTarget(
      instance,
      input.pick.id,
      resolveSelectionMode(input.event)
    )
    if (!target) {
      return undefined
    }

    return {
      frame,
      target
    }
  }

  const nodeRect = instance.read.index.node.get(input.pick.id)
  if (!nodeRect) {
    return undefined
  }

  return {
    frame,
    target: {
      kind: 'container-body',
      nodeRect
    }
  }
}

const resolvePressGesture = (
  instance: InternalInstance,
  input: CanvasDown
): PressGesture | undefined => (
  resolveNodeBodyGesture(instance, input)
  ?? resolveSelectionBoxGesture(instance, input)
  ?? resolveCanvasGesture(instance, input)
)

export const createNodeGesture = (
  instance: InternalInstance,
  marquee: MarqueeSession
) => {
  const press = createNodePressController(instance, marquee)

  const beginPointerGesture = (
    event: PointerGestureEvent,
    capture: Element,
    gesture: PressGesture
  ) => {
    const started = press.begin({
      pointerId: event.pointerId,
      capture,
      clientX: event.clientX,
      clientY: event.clientY,
      selectionMode: resolveSelectionMode(event),
      frame: gesture.frame
    } satisfies PressInput, gesture.target)
    if (!started) {
      return false
    }

    stopPointerDown(event)
    return true
  }

  return {
    cancel: press.cancel,
    down: (
      input: CanvasDown
    ) => {
      if (!canHandleDown(input)) {
        return false
      }

      const gesture = resolvePressGesture(instance, input)
      if (!gesture) {
        return false
      }

      return beginPointerGesture(input.event, input.capture, gesture)
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
        || nodeEntry.node.type === 'group'
      ) {
        return
      }

      instance.commands.frame.enter(nodeId)
      event.preventDefault()
      event.stopPropagation()
    }
  }
}

export type NodeGesture = ReturnType<typeof createNodeGesture>
