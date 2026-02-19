import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import { applyCommandChange } from './apply'

export const createViewport = (instance: Instance): Commands['viewport'] => ({
  set: (viewport) => applyCommandChange(instance, { type: 'viewport.set', viewport }),
  panBy: (delta) => applyCommandChange(instance, { type: 'viewport.panBy', delta }),
  zoomBy: (factor, anchor) => applyCommandChange(instance, { type: 'viewport.zoomBy', factor, anchor }),
  zoomTo: (zoom, anchor) => applyCommandChange(instance, { type: 'viewport.zoomTo', zoom, anchor }),
  reset: () => applyCommandChange(instance, { type: 'viewport.reset' })
})
