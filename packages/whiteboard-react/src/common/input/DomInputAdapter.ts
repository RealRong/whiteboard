import type { Instance, PointerPhase, PointerStage } from '@whiteboard/engine'
import { DomEffectRunner } from './DomEffectRunner'
import {
  toKeyInputEvent,
  toPointerInputEvent
} from './DomEventMapper'
import {
  ViewportGestureController,
  type ViewportPolicy
} from './ViewportGestureController'

type DomInputAdapterOptions = {
  viewportPolicy: ViewportPolicy
  getContainer: () => HTMLDivElement | null
}

export class DomInputAdapter {
  private instance: Instance
  private getContainer: () => HTMLDivElement | null
  private effects: DomEffectRunner
  private viewportGestures: ViewportGestureController
  private started = false
  private offContainer: (() => void) | null = null
  private offWindowBlur: (() => void) | null = null
  private offWindowKey: (() => void) | null = null

  constructor(instance: Instance, options: DomInputAdapterOptions) {
    this.instance = instance
    this.getContainer = options.getContainer
    this.viewportGestures = new ViewportGestureController({
      instance,
      viewportPolicy: options.viewportPolicy,
      getContainer: this.getContainer
    })
    this.effects = new DomEffectRunner({
      getContainer: this.getContainer,
      onWindowPointerMove: this.handleWindowPointerMove,
      onWindowPointerUp: this.handleWindowPointerUp,
      onWindowPointerCancel: this.handleWindowPointerCancel
    })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.bindContainerEvents()
    this.bindWindowBlur()
    this.bindWindowKey()
  }

  stop = () => {
    if (!this.started) return
    this.started = false
    this.viewportGestures.reset()
    this.effects.run(this.instance.input.reset('forced').effects)
    this.effects.stop()
    this.offContainer?.()
    this.offContainer = null
    this.offWindowBlur?.()
    this.offWindowBlur = null
    this.offWindowKey?.()
    this.offWindowKey = null
  }

  private bindContainerEvents = () => {
    const container = this.getContainer()
    if (!container) return

    container.addEventListener('pointerdown', this.handleContainerPointerDown)
    container.addEventListener(
      'pointerdown',
      this.handleContainerPointerDownCapture,
      true
    )
    container.addEventListener('pointermove', this.handleContainerPointerMove)
    container.addEventListener('pointerup', this.handleContainerPointerUp)
    container.addEventListener('keydown', this.handleContainerKeyDown)
    container.addEventListener('keyup', this.handleContainerKeyUp)
    container.addEventListener('wheel', this.handleContainerWheel, {
      passive: false
    })

    this.offContainer = () => {
      container.removeEventListener('pointerdown', this.handleContainerPointerDown)
      container.removeEventListener(
        'pointerdown',
        this.handleContainerPointerDownCapture,
        true
      )
      container.removeEventListener('pointermove', this.handleContainerPointerMove)
      container.removeEventListener('pointerup', this.handleContainerPointerUp)
      container.removeEventListener('keydown', this.handleContainerKeyDown)
      container.removeEventListener('keyup', this.handleContainerKeyUp)
      container.removeEventListener('wheel', this.handleContainerWheel)
    }
  }

  private bindWindowBlur = () => {
    if (typeof window === 'undefined') return
    const onBlur = () => {
      this.viewportGestures.reset()
      this.effects.run(
        this.instance.input.handle({
          kind: 'focus',
          phase: 'blur',
          timestamp:
            typeof performance !== 'undefined' ? performance.now() : Date.now(),
          source: 'window'
        }).effects
      )
    }
    window.addEventListener('blur', onBlur)
    this.offWindowBlur = () => {
      window.removeEventListener('blur', onBlur)
    }
  }

  private bindWindowKey = () => {
    if (typeof window === 'undefined') return
    const isFromContainer = (target: EventTarget | null) => {
      const container = this.getContainer()
      if (!container) return false
      if (!(target instanceof Node)) return false
      return container.contains(target)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isFromContainer(event.target)) return
      this.dispatchKey(event, 'down', 'window')
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return
      if (isFromContainer(event.target)) return
      this.dispatchKey(event, 'up', 'window')
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    this.offWindowKey = () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }

  private resolveFocusTarget = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    const candidate = target.closest(
      '[tabindex],a[href],button,input,select,textarea,[contenteditable=""],[contenteditable="true"]'
    )
    return candidate instanceof HTMLElement ? candidate : null
  }

  private handleContainerPointerDown = (event: PointerEvent) => {
    const container = this.getContainer()
    const startedPan = this.viewportGestures.onPointerDown(event)
    if (!startedPan) {
      this.dispatchPointer(event, 'bubble', 'down', 'container')
    }
    if (event.target === container) {
      container?.focus({ preventScroll: true })
      this.instance.commands.edge.select(undefined)
      return
    }
    const focusTarget = this.resolveFocusTarget(event.target)
    if (focusTarget) {
      focusTarget.focus({ preventScroll: true })
      return
    }
    container?.focus({ preventScroll: true })
  }

  private handleContainerPointerDownCapture = (event: PointerEvent) => {
    this.dispatchPointer(event, 'capture', 'down', 'container')
  }

  private handleContainerPointerMove = (event: PointerEvent) => {
    if (this.viewportGestures.isPanning()) return
    this.dispatchPointer(event, 'bubble', 'move', 'container')
  }

  private handleContainerPointerUp = (event: PointerEvent) => {
    if (this.viewportGestures.isPanning()) {
      this.viewportGestures.onPointerUp(event)
      return
    }
    this.dispatchPointer(event, 'bubble', 'up', 'container')
  }

  private handleContainerKeyDown = (event: KeyboardEvent) => {
    this.dispatchKey(event, 'down', 'container')
  }

  private handleContainerKeyUp = (event: KeyboardEvent) => {
    this.dispatchKey(event, 'up', 'container')
  }

  private handleContainerWheel = (event: WheelEvent) => {
    this.viewportGestures.onWheel(event)
  }

  private handleWindowPointerMove = (event: PointerEvent) => {
    this.dispatchPointer(event, 'bubble', 'move', 'window')
  }

  private handleWindowPointerUp = (event: PointerEvent) => {
    this.dispatchPointer(event, 'bubble', 'up', 'window')
  }

  private handleWindowPointerCancel = (event: PointerEvent) => {
    this.dispatchPointer(event, 'bubble', 'cancel', 'window')
  }

  private dispatchPointer = (
    event: PointerEvent,
    stage: PointerStage,
    phase: PointerPhase,
    source: 'container' | 'window'
  ) => {
    const pointerEvent = toPointerInputEvent({
      instance: this.instance,
      event,
      stage,
      phase,
      source
    })
    const result = this.instance.input.handle(pointerEvent)
    this.effects.run(result.effects, event)
  }

  private dispatchKey = (
    event: KeyboardEvent,
    phase: 'down' | 'up',
    source: 'container' | 'window'
  ) => {
    const result = this.instance.input.handle(toKeyInputEvent(event, phase, source))
    this.effects.run(result.effects, event)
  }
}
