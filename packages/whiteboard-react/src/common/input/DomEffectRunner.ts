import type { InputEffect, Instance } from '@whiteboard/engine'

type DomEffectRunnerOptions = {
  instance: Instance
  onWindowPointerMove: (event: PointerEvent) => void
  onWindowPointerUp: (event: PointerEvent) => void
  onWindowPointerCancel: (event: PointerEvent) => void
}

export class DomEffectRunner {
  private instance: Instance
  private onWindowPointerMove: (event: PointerEvent) => void
  private onWindowPointerUp: (event: PointerEvent) => void
  private onWindowPointerCancel: (event: PointerEvent) => void
  private offWindowPointer: (() => void) | null = null

  constructor({
    instance,
    onWindowPointerMove,
    onWindowPointerUp,
    onWindowPointerCancel
  }: DomEffectRunnerOptions) {
    this.instance = instance
    this.onWindowPointerMove = onWindowPointerMove
    this.onWindowPointerUp = onWindowPointerUp
    this.onWindowPointerCancel = onWindowPointerCancel
  }

  run = (effects: InputEffect[], event?: PointerEvent | KeyboardEvent | WheelEvent) => {
    for (const effect of effects) {
      if (effect.type === 'capturePointer') {
        this.capturePointer(effect.pointerId)
        continue
      }
      if (effect.type === 'releasePointer') {
        this.releasePointer(effect.pointerId)
        continue
      }
      if (effect.type === 'setWindowPointerTracking') {
        this.setWindowPointerTracking(effect.enabled)
        continue
      }
      if (effect.type === 'preventDefault') {
        event?.preventDefault()
        continue
      }
      if (effect.type === 'stopPropagation') {
        event?.stopPropagation()
        continue
      }
      if (effect.type === 'setCursor') {
        this.setCursor(effect.cursor)
      }
    }
  }

  stop = () => {
    this.setWindowPointerTracking(false)
  }

  private capturePointer = (pointerId: number) => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return
    try {
      container.setPointerCapture(pointerId)
    } catch {
      // Ignore pointer capture failures when pointer is no longer active.
    }
  }

  private releasePointer = (pointerId: number) => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return
    try {
      container.releasePointerCapture(pointerId)
    } catch {
      // Ignore pointer release failures when capture is already cleared.
    }
  }

  private setCursor = (cursor: string) => {
    const container = this.instance.runtime.containerRef.current
    if (!container) return
    container.style.cursor = cursor
  }

  private setWindowPointerTracking = (enabled: boolean) => {
    if (typeof window === 'undefined') return

    if (!enabled) {
      this.offWindowPointer?.()
      this.offWindowPointer = null
      return
    }

    if (this.offWindowPointer) return

    const handlePointerMove = (event: PointerEvent) =>
      this.onWindowPointerMove(event)
    const handlePointerUp = (event: PointerEvent) => this.onWindowPointerUp(event)
    const handlePointerCancel = (event: PointerEvent) =>
      this.onWindowPointerCancel(event)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerCancel)

    this.offWindowPointer = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerCancel)
    }
  }
}
