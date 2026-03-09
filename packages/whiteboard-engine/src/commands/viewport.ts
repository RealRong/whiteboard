import type {
  Commands,
  WriteCommandMap
} from '@engine-types/command'
import type { ViewportCommandsApi } from '@engine-types/write'
import type { Point } from '@whiteboard/core/types'
import type { Apply } from '../write/draft'

type ViewportCommand = WriteCommandMap['viewport']

export const viewport = ({
  apply
}: {
  apply: Apply
}): ViewportCommandsApi => {
  const run = (command: ViewportCommand) =>
    apply({
      domain: 'viewport',
      command,
      source: 'ui'
    })

  const set: Commands['viewport']['set'] = (viewport) =>
    run({ type: 'set', viewport })

  const panBy: Commands['viewport']['panBy'] = (delta) =>
    run({ type: 'panBy', delta })

  const zoomBy: Commands['viewport']['zoomBy'] = (factor, anchor?: Point) =>
    run({ type: 'zoomBy', factor, anchor })

  const zoomTo: Commands['viewport']['zoomTo'] = (zoom, anchor?: Point) =>
    run({ type: 'zoomTo', zoom, anchor })

  const reset: Commands['viewport']['reset'] = () =>
    run({ type: 'reset' })

  return {
    set,
    panBy,
    zoomBy,
    zoomTo,
    reset
  }
}
