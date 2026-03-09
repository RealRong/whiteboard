import type { InstanceConfig } from '@engine-types/instance'
import { mergeValue } from '@whiteboard/core/utils'
import {
  DEFAULT_HISTORY_CONFIG,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS
} from './defaults'

export {
  DEFAULT_HISTORY_CONFIG,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS,
  DEFAULT_MINDMAP_LAYOUT,
  DEFAULT_TUNING
} from './defaults'

export const resolveInstanceConfig = (
  configOverrides?: Partial<InstanceConfig>
): InstanceConfig => mergeValue(DEFAULT_INSTANCE_CONFIG, configOverrides)
