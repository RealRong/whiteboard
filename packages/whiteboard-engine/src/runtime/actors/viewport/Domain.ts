import type { InternalInstance } from '@engine-types/instance/instance'
import type { DispatchResult, Point, Viewport } from '@whiteboard/core'

type DomainInstance = Pick<InternalInstance, 'runtime' | 'mutate'>

type DomainOptions = {
  instance: DomainInstance
}

export class Domain {
  readonly name = 'ViewportDomain'

  private readonly instance: DomainInstance

  constructor({ instance }: DomainOptions) {
    this.instance = instance
  }

  private applyViewportSet = async (
    viewport: Viewport
  ): Promise<DispatchResult> => {
    const built = this.instance.runtime.core.apply.build({ type: 'viewport.set', viewport })
    if (!built.ok) return built

    const applied = await this.instance.mutate(built.operations, {
      source: 'command',
      actor: 'viewport.set'
    })
    if (!applied.dispatchResult.ok) {
      return applied.dispatchResult
    }
    if (typeof built.value === 'undefined') {
      return applied.dispatchResult
    }
    return {
      ...applied.dispatchResult,
      value: built.value
    }
  }

  private readViewport = () => this.instance.runtime.core.query.viewport()

  set = (viewport: Viewport) => this.applyViewportSet(viewport)

  panBy = (delta: { x: number; y: number }) => {
    const before = this.readViewport()
    return this.applyViewportSet({
      center: {
        x: before.center.x + delta.x,
        y: before.center.y + delta.y
      },
      zoom: before.zoom
    })
  }

  zoomBy = (factor: number, anchor?: Point) => {
    const before = this.readViewport()
    const afterCenter = anchor
      ? {
          x: anchor.x - (anchor.x - before.center.x) / factor,
          y: anchor.y - (anchor.y - before.center.y) / factor
        }
      : before.center
    return this.applyViewportSet({
      center: afterCenter,
      zoom: before.zoom * factor
    })
  }

  zoomTo = (zoom: number, anchor?: Point) => {
    const before = this.readViewport()
    if (before.zoom === 0) {
      return this.applyViewportSet({
        center: { x: 0, y: 0 },
        zoom
      })
    }
    const factor = zoom / before.zoom
    const afterCenter = anchor
      ? {
          x: anchor.x - (anchor.x - before.center.x) / factor,
          y: anchor.y - (anchor.y - before.center.y) / factor
        }
      : before.center
    return this.applyViewportSet({
      center: afterCenter,
      zoom
    })
  }

  reset = () =>
    this.applyViewportSet({
      center: { x: 0, y: 0 },
      zoom: 1
    })
}

