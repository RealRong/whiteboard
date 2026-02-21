import type { Command } from '@engine-types/command'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance/instance'
import type { ApplyCommandChange } from './shared'

export const createViewport = (_instance: Instance, applyChange: ApplyCommandChange): Commands['viewport'] => {
  const applyViewportChange = (change: Command) => applyChange(change)

  return {
    set: (viewport) => applyViewportChange({ type: 'viewport.set', viewport }),
    panBy: (delta) => applyViewportChange({ type: 'viewport.panBy', delta }),
    zoomBy: (factor, anchor) => applyViewportChange({ type: 'viewport.zoomBy', factor, anchor }),
    zoomTo: (zoom, anchor) => applyViewportChange({ type: 'viewport.zoomTo', zoom, anchor }),
    reset: () => applyViewportChange({ type: 'viewport.reset' })
  }
}
