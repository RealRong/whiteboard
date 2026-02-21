import type {
  Instance,
  KeyInputEvent,
  PointerInputEvent,
  PointerPhase,
  PointerStage,
  WheelInputEvent
} from '@whiteboard/engine'

type PointerSource = 'container' | 'window'
type TargetSource = PointerSource | KeyInputEvent['source']

const normalizePointerButton = (button: number): 0 | 1 | 2 => {
  if (button === 1 || button === 2) return button
  return 0
}

const normalizePointerType = (
  pointerType: string
): PointerInputEvent['pointerType'] => {
  if (pointerType === 'mouse') return 'mouse'
  if (pointerType === 'pen') return 'pen'
  if (pointerType === 'touch') return 'touch'
  return 'unknown'
}

const toOptionalNumber = (value: string | undefined) => {
  if (value === undefined) return undefined
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return undefined
  return parsed
}

const toOptionalNodeId = (
  value: string | undefined
): PointerInputEvent['target']['nodeId'] =>
  value && value.length > 0
    ? (value as PointerInputEvent['target']['nodeId'])
    : undefined

const isTextInputElement = (element: Element | null) => {
  if (!element) return false
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase()
    return (
      type === 'text'
      || type === 'search'
      || type === 'email'
      || type === 'url'
      || type === 'tel'
      || type === 'password'
      || type === 'number'
      || type === 'date'
      || type === 'datetime-local'
      || type === 'month'
      || type === 'time'
      || type === 'week'
    )
  }
  return element instanceof HTMLElement && element.isContentEditable
}

const resolveTargetByEventTarget = (
  eventTarget: EventTarget | null,
  source: TargetSource
): PointerInputEvent['target'] => {
  const baseSurface: PointerInputEvent['target']['surface'] =
    source === 'container' ? 'canvas' : 'unknown'

  if (!(eventTarget instanceof Element)) {
    return { surface: baseSurface }
  }

  const target = eventTarget as HTMLElement | SVGElement
  const inputRoleElement = target.closest('[data-input-role]') as HTMLElement | SVGElement | null
  const ignoreElement = target.closest('[data-input-ignore], [data-selection-ignore]')
  const editableElement = target.closest(
    'input,textarea,select,[contenteditable]:not([contenteditable="false"])'
  )
  const isTextInput = isTextInputElement(editableElement)
  if (ignoreElement) {
    const shouldIgnore =
      !inputRoleElement
      || (ignoreElement !== inputRoleElement && inputRoleElement.contains(ignoreElement))
    if (shouldIgnore) {
      return { surface: baseSurface, ignoreInput: true, isTextInput }
    }
  }
  if (editableElement && !inputRoleElement) {
    return { surface: baseSurface, ignoreInput: true, isTextInput }
  }
  const inputRole = inputRoleElement?.dataset.inputRole

  if (inputRoleElement) {
    if (inputRole === 'edge-routing-point') {
      return {
        surface: baseSurface,
        role: 'handle',
        handleType: 'edge-routing',
        edgeId: inputRoleElement.dataset.edgeId as PointerInputEvent['target']['edgeId'],
        routingIndex: toOptionalNumber(inputRoleElement.dataset.routingIndex)
      }
    }

    if (inputRole === 'edge-endpoint-handle') {
      const edgeEnd = inputRoleElement.dataset.edgeEnd
      return {
        surface: baseSurface,
        role: 'handle',
        handleType: 'edge-endpoint',
        edgeId: inputRoleElement.dataset.edgeId as PointerInputEvent['target']['edgeId'],
        edgeEnd:
          edgeEnd === 'source' || edgeEnd === 'target'
            ? edgeEnd
            : undefined
      }
    }

    if (inputRole === 'node-transform-handle') {
      const transformKind = inputRoleElement.dataset.transformKind
      const resizeDirection = inputRoleElement.dataset.resizeDirection
      return {
        surface: baseSurface,
        role: 'handle',
        handleType: 'node-transform',
        nodeId: toOptionalNodeId(inputRoleElement.dataset.nodeId),
        transformKind:
          transformKind === 'resize' || transformKind === 'rotate'
            ? transformKind
            : undefined,
        resizeDirection:
          resizeDirection === 'nw'
          || resizeDirection === 'n'
          || resizeDirection === 'ne'
          || resizeDirection === 'e'
          || resizeDirection === 'se'
          || resizeDirection === 's'
          || resizeDirection === 'sw'
          || resizeDirection === 'w'
            ? resizeDirection
            : undefined
      }
    }

    if (inputRole === 'node-edge-handle') {
      const side = inputRoleElement.dataset.handleSide
      const nodeId = toOptionalNodeId(inputRoleElement.dataset.nodeId)
        ?? toOptionalNodeId(
          (target.closest('[data-node-id]') as HTMLElement | SVGElement | null)?.dataset.nodeId
        )
      return {
        surface: baseSurface,
        role: 'handle',
        handleType: 'node-connect',
        nodeId,
        handleSide:
          side === 'top' || side === 'right' || side === 'bottom' || side === 'left'
            ? side
            : undefined
      }
    }

    if (inputRole === 'mindmap-node') {
      const treeId = toOptionalNodeId(
        (target.closest('[data-mindmap-tree-id]') as HTMLElement | SVGElement | null)?.dataset.mindmapTreeId
      )
      return {
        surface: baseSurface,
        role: 'handle',
        handleType: 'mindmap-node',
        nodeId: toOptionalNodeId(inputRoleElement.dataset.mindmapNodeId),
        treeId
      }
    }
  }

  const nodeId = toOptionalNodeId(
    (target.closest('[data-node-id]') as HTMLElement | SVGElement | null)?.dataset.nodeId
  )
  if (nodeId) {
    return {
      surface: baseSurface,
      role: 'node',
      nodeId
    }
  }

  const edgeId = (target.closest('[data-edge-id]') as HTMLElement | SVGElement | null)?.dataset.edgeId
  if (edgeId) {
    return {
      surface: baseSurface,
      role: 'edge',
      edgeId: edgeId as PointerInputEvent['target']['edgeId']
    }
  }

  return { surface: baseSurface }
}

const resolvePointerTarget = ({
  event,
  source,
  isBackground
}: {
  event: PointerEvent
  source: PointerSource
  isBackground: boolean
}): PointerInputEvent['target'] => {
  if (isBackground) {
    return {
      surface: 'canvas',
      role: 'background'
    }
  }
  return resolveTargetByEventTarget(event.target, source)
}

export const toKeyInputEvent = (
  event: KeyboardEvent,
  phase: KeyInputEvent['phase'],
  source: KeyInputEvent['source']
): KeyInputEvent => ({
  kind: 'key',
  phase,
  key: event.key,
  code: event.code,
  repeat: event.repeat,
  modifiers: {
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  },
  target: resolveTargetByEventTarget(event.target, source),
  isComposing: event.isComposing,
  timestamp: event.timeStamp,
  source
})

type PointerEventOptions = {
  instance: Instance
  event: PointerEvent
  stage: PointerStage
  phase: PointerPhase
  source: PointerSource
}

export const toPointerInputEvent = ({
  instance,
  event,
  stage,
  phase,
  source
}: PointerEventOptions): PointerInputEvent => {
  const button = normalizePointerButton(event.button)
  const client = {
    x: event.clientX,
    y: event.clientY
  }
  const screen = instance.runtime.viewport.clientToScreen(
    event.clientX,
    event.clientY
  )
  const modifiers = {
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  }
  const pointer = {
    pointerId: event.pointerId,
    button,
    client,
    screen,
    world: instance.runtime.viewport.screenToWorld(screen),
    modifiers
  }
  const isBackground = instance.query.canvas.isBackgroundTarget(event.target)
  const target = resolvePointerTarget({
    event,
    source,
    isBackground
  })

  return {
    kind: 'pointer',
    stage,
    phase,
    clickCount: event.detail,
    pointer,
    pointerId: event.pointerId,
    pointerType: normalizePointerType(event.pointerType),
    button,
    buttons: event.buttons,
    client,
    screen,
    modifiers: {
      ...modifiers,
      space: instance.state.read('spacePressed')
    },
    target,
    timestamp: event.timeStamp,
    source
  }
}

export const toWheelInputEvent = (
  event: WheelEvent,
  source: WheelInputEvent['source']
): WheelInputEvent => ({
  kind: 'wheel',
  client: {
    x: event.clientX,
    y: event.clientY
  },
  deltaX: event.deltaX,
  deltaY: event.deltaY,
  deltaZ: event.deltaZ,
  modifiers: {
    shift: event.shiftKey,
    alt: event.altKey,
    ctrl: event.ctrlKey,
    meta: event.metaKey
  },
  timestamp: event.timeStamp,
  source
})
