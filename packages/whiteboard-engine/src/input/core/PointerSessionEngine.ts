import type {
  CancelReason,
  InputEffect,
  InputResult,
  InputSessionContext,
  PointerInputEvent,
  PointerSession,
  PointerSessionRuntime
} from '@engine-types/input'

type ActivePointerSession = {
  runtime: PointerSessionRuntime
  pointerId: number
}

type PointerSessionEngineOptions = {
  getContext: () => InputSessionContext
  sessions?: PointerSession[]
}

export class PointerSessionEngine {
  private active: ActivePointerSession | null = null
  private sessions: PointerSession[] = []

  constructor({ getContext, sessions }: PointerSessionEngineOptions) {
    this.getContext = getContext
    if (sessions?.length) {
      this.setSessions(sessions)
    }
  }

  private readonly getContext: () => InputSessionContext

  setSessions = (sessions: PointerSession[]) => {
    this.sessions = [...sessions].sort((left, right) => right.priority - left.priority)
  }

  dispatch = (event: PointerInputEvent): InputResult => {
    if (event.stage === 'capture') {
      return { effects: [] }
    }
    if (event.phase === 'down') {
      return this.startSession(event)
    }
    if (event.phase === 'move') {
      if (this.active) {
        return this.updateSession(event)
      }
      const started = this.startSession(event)
      const active = this.active as ActivePointerSession | null
      if (!active || active.pointerId !== event.pointerId) {
        return started
      }
      const context = this.getContext()
      active.runtime.update(event, context)
      this.active = active
      return started
    }
    if (event.phase === 'up') {
      return this.endSession(event)
    }
    return this.cancelSession('pointercancel', event)
  }

  cancelActive = (reason: CancelReason): InputResult => {
    if (!this.active) {
      return { effects: [] }
    }
    const context = this.getContext()
    const active = this.active
    this.active = null
    active.runtime.cancel(reason, context)
    return {
      effects: [
        { type: 'releasePointer', pointerId: active.pointerId },
        { type: 'setWindowPointerTracking', enabled: false }
      ]
    }
  }

  private startSession = (event: PointerInputEvent): InputResult => {
    if (this.active) {
      return { effects: [] }
    }
    const context = this.getContext()
    for (const session of this.sessions) {
      if (!session.canStart(event, context)) continue
      const runtime = session.start(event, context)
      if (runtime === null) continue
      this.active = {
        runtime,
        pointerId: runtime.pointerId
      }
      const effects: InputEffect[] = [
        { type: 'capturePointer', pointerId: runtime.pointerId },
        { type: 'setWindowPointerTracking', enabled: true }
      ]
      return { effects }
    }
    return { effects: [] }
  }

  private updateSession = (event: PointerInputEvent): InputResult => {
    if (!this.active || this.active.pointerId !== event.pointerId) {
      return { effects: [] }
    }
    const context = this.getContext()
    this.active.runtime.update(event, context)
    return { effects: [] }
  }

  private endSession = (event: PointerInputEvent): InputResult => {
    if (!this.active || this.active.pointerId !== event.pointerId) {
      return { effects: [] }
    }
    const context = this.getContext()
    const active = this.active
    this.active = null
    active.runtime.end(event, context)
    return {
      effects: [
        { type: 'releasePointer', pointerId: active.pointerId },
        { type: 'setWindowPointerTracking', enabled: false }
      ]
    }
  }

  private cancelSession = (
    reason: CancelReason,
    event: PointerInputEvent
  ): InputResult => {
    if (!this.active || this.active.pointerId !== event.pointerId) {
      return { effects: [] }
    }
    return this.cancelActive(reason)
  }
}
