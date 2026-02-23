import type { InternalInstance } from '@engine-types/instance/instance'
import type { ApplyMutationsApi } from '@engine-types/command'
import { panViewport, zoomViewport } from '@whiteboard/core/geometry'
import type { DispatchResult, Point, Viewport } from '@whiteboard/core/types'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'

type DomainInstance = Pick<InternalInstance, 'runtime'>

type DomainOptions = {
  instance: DomainInstance
  mutate: ApplyMutationsApi
}

export class Domain {
  readonly name = 'ViewportDomain'

  private readonly instance: DomainInstance
  private readonly mutate: ApplyMutationsApi

  constructor({ instance, mutate }: DomainOptions) {
    this.instance = instance
    this.mutate = mutate
  }

  private createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  private readViewport = () =>
    this.instance.runtime.document.get().viewport ?? DEFAULT_DOCUMENT_VIEWPORT

  private applyViewport = (
    before: Viewport,
    after: Viewport
  ): Promise<DispatchResult> =>
    this.mutate(
      [
        {
          type: 'viewport.update',
          before,
          after
        }
      ],
      'ui'
    )

  set = (viewport: Viewport) => {
    if (!viewport.center) {
      return Promise.resolve(this.createInvalidResult('Missing viewport center.'))
    }
    if (!Number.isFinite(viewport.zoom) || viewport.zoom <= 0) {
      return Promise.resolve(this.createInvalidResult('Invalid viewport zoom.'))
    }
    return this.applyViewport(this.readViewport(), viewport)
  }

  panBy = (delta: { x: number; y: number }) => {
    if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
      return Promise.resolve(this.createInvalidResult('Invalid pan delta.'))
    }
    const before = this.readViewport()
    return this.applyViewport(before, panViewport(before, delta))
  }

  zoomBy = (factor: number, anchor?: Point) => {
    if (!Number.isFinite(factor) || factor <= 0) {
      return Promise.resolve(this.createInvalidResult('Invalid zoom factor.'))
    }
    const before = this.readViewport()
    return this.applyViewport(before, zoomViewport(before, factor, anchor))
  }

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
