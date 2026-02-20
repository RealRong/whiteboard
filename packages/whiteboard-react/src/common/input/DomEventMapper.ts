import type {
  Instance,
  KeyInputEvent,
  PointerInputEvent,
  PointerPhase,
  PointerStage,
  WheelInputEvent
} from '@whiteboard/engine'

type PointerSource = 'container' | 'window'

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

  return {
    kind: 'pointer',
    stage,
    phase,
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
    target: isBackground
      ? {
          surface: 'canvas',
          role: 'background'
        }
      : {
          surface: source === 'container' ? 'canvas' : 'unknown'
        },
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
