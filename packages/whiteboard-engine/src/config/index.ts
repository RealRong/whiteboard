import type { InstanceConfig } from '@engine-types/instance'
import { mergeValue } from '@whiteboard/core/utils'
import {
  DEFAULT_DOCUMENT_VIEWPORT,
  DEFAULT_HISTORY_CONFIG,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS
} from './defaults'

export {
  DEFAULT_DOCUMENT_VIEWPORT,
  DEFAULT_HISTORY_CONFIG,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS,
  DEFAULT_MINDMAP_LAYOUT,
  DEFAULT_TUNING
} from './defaults'

export const resolveInstanceConfig = (
  configOverrides?: Partial<InstanceConfig>
): InstanceConfig => {
  const merged = mergeValue(DEFAULT_INSTANCE_CONFIG, configOverrides)

  return {
    ...merged,
    viewport: {
      ...merged.viewport,
      wheelSensitivity: Math.max(0, merged.viewport.wheelSensitivity)
    }
  }
}
