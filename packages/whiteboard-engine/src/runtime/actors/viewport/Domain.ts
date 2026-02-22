import type { InternalInstance } from '@engine-types/instance/instance'
import type { CommandSource } from '@engine-types/command'
import type { DispatchResult, Intent, Point, Viewport } from '@whiteboard/core'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'

type DomainInstance = Pick<InternalInstance, 'runtime'>

type ViewportIntent = Extract<
  Intent,
  | { type: 'viewport.set' }
  | { type: 'viewport.pan' }
  | { type: 'viewport.zoom' }
>

type IntentDispatcher = (
  command: ViewportIntent,
  options: { source?: CommandSource; actor?: string }
) => Promise<DispatchResult>

type DomainOptions = {
  instance: DomainInstance
  dispatchIntent: IntentDispatcher
}

export class Domain {
  readonly name = 'ViewportDomain'

  private readonly instance: DomainInstance
  private readonly dispatchIntent: IntentDispatcher

  constructor({ instance, dispatchIntent }: DomainOptions) {
    this.instance = instance
    this.dispatchIntent = dispatchIntent
  }

  private dispatchViewportIntent = (
    command: ViewportIntent,
    actor: string
  ): Promise<DispatchResult> =>
    this.dispatchIntent(
      command,
      {
        source: 'command',
        actor
      }
    )

  private readViewport = () =>
    this.instance.runtime.document.get().viewport ?? DEFAULT_DOCUMENT_VIEWPORT

  set = (viewport: Viewport) =>
    this.dispatchViewportIntent(
      { type: 'viewport.set', viewport },
      'viewport.set'
    )

  panBy = (delta: { x: number; y: number }) =>
    this.dispatchViewportIntent(
      { type: 'viewport.pan', delta },
      'viewport.pan'
    )

  zoomBy = (factor: number, anchor?: Point) =>
    this.dispatchViewportIntent(
      { type: 'viewport.zoom', factor, anchor },
      'viewport.zoom'
    )

  zoomTo = (zoom: number, anchor?: Point) => {
    const before = this.readViewport()
    if (before.zoom === 0) {
      return this.set({
        center: before.center,
        zoom
      })
    }
    return this.zoomBy(zoom / before.zoom, anchor)
  }

  reset = () => this.set(DEFAULT_DOCUMENT_VIEWPORT)
}
