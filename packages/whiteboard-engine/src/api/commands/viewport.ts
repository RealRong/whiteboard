import type { Commands } from '@engine-types/commands'
import type { Domain as ViewportDomainActor } from '../../runtime/actors/viewport/Domain'

export const createViewport = (
  viewport: ViewportDomainActor
): Commands['viewport'] => ({
  set: viewport.set,
  panBy: viewport.panBy,
  zoomBy: viewport.zoomBy,
  zoomTo: viewport.zoomTo,
  reset: viewport.reset
})

